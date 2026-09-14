import { lookup } from 'node:dns/promises'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

const blockedV4 = new BlockList()
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['168.63.129.16', 32], ['192.88.99.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) blockedV4.addSubnet(address, prefix, 'ipv4')
const globalV6 = new BlockList()
globalV6.addSubnet('2000::', 3, 'ipv6')
const blockedV6 = new BlockList()
blockedV6.addSubnet('2001::', 23, 'ipv6')
blockedV6.addSubnet('2001:db8::', 32, 'ipv6')
blockedV6.addSubnet('2002::', 16, 'ipv6')

function validateUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid provider endpoint')
  }
}

export function normalizeApiBase(input: string): string {
  const url = new URL(input)
  validateUrl(url)
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/$/, '')
}

export async function createSafeLookup(url: URL): Promise<LookupFunction> {
  validateUrl(url)
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  const allowed = (process.env.PROBE_ALLOWED_PRIVATE_HOSTS || '').split(',').map(value => value.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')).includes(host)
  let timeout: NodeJS.Timeout | undefined
  const deadline = Promise.withResolvers<never>()
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await Promise.race([
        lookup(host, { all: true, verbatim: true }),
        (timeout = setTimeout(() => deadline.reject(new Error('Provider DNS lookup timed out')), 5000), deadline.promise),
      ]).finally(() => clearTimeout(timeout))
  if (!addresses.length || addresses.some(({ address, family }) => !allowed && (family === 4
    ? blockedV4.check(address, 'ipv4')
    : !globalV6.check(address, 'ipv6') || blockedV6.check(address, 'ipv6')))) {
    throw new Error('Provider endpoint is not permitted')
  }
  return (_host, options, callback) => {
    const family = options.family
    const selected = family ? addresses.filter(address => address.family === family) : addresses
    if (!selected.length) { callback(new Error('Provider address family unavailable'), ''); return }
    if (options.all) callback(null, selected)
    else callback(null, selected[0]!.address, selected[0]!.family)
  }
}

export async function safeRequest(url: URL, options: {
  method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number; maxBytes?: number
} = {}): Promise<{ status: number; body: string }> {
  const pinnedLookup = await createSafeLookup(url)
  const { promise, resolve, reject } = Promise.withResolvers<{ status: number; body: string }>()
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: options.method || 'GET', headers: options.headers, lookup: pinnedLookup,
    }, response => {
      if ((response.statusCode || 0) >= 300 && (response.statusCode || 0) < 400) {
        response.destroy(); request.destroy(new Error('Provider redirects are not permitted')); return
      }
      const chunks: Buffer[] = []
      let bytes = 0
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > (options.maxBytes ?? 2 * 1024 * 1024)) { request.destroy(new Error('Provider response is too large')); return }
        chunks.push(chunk)
      })
      response.on('error', reject)
      response.on('end', () => resolve({ status: response.statusCode || 502, body: Buffer.concat(chunks).toString('utf8') }))
    })
    const timer = setTimeout(() => request.destroy(new Error('Provider request timed out')), options.timeoutMs ?? 15000)
    request.on('close', () => clearTimeout(timer))
    request.on('error', reject)
    request.end(options.body)
  return promise
}
