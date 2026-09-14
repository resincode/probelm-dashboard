import { execFile } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, request as httpRequest, Agent as HttpAgent, type ClientRequest } from 'node:http'
import { request as httpsRequest, Agent as HttpsAgent } from 'node:https'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ProbeInsert, ProviderModel, RunStatus } from './db'
import { createSafeLookup } from './network'
import { prepareProviderTarget } from './provider-store'
import { acquireRun, completeRun, renewRun, type RunLease } from './scheduler'

const execFileAsync = promisify(execFile)
const LOCAL_BIN = join(homedir(), '.local', 'bin', 'probelm')
const MTEST = process.env.PROBELM_BIN || process.env.MTEST_BIN || (existsSync(LOCAL_BIN) ? LOCAL_BIN : 'probelm')

export interface RunResult { runId: number | null; modelCount: number; status: RunStatus | 'skipped'; error: string | null }
export interface WorkerOptions { trigger?: string; scheduled?: boolean; signal?: AbortSignal }
interface MTestProbe { model: string; ping: { ok: boolean; http_code: number } | null; latency: Record<string, unknown> | null }
interface ProbeRelay { baseUrl: string; apiKey: string; failedModels: Set<string>; close(): Promise<void> }
function measurement(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null }

function parseOutput(stdout: string): MTestProbe[] | null {
  try {
    const parsed = JSON.parse(stdout) as { probes?: unknown }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.probes)) return null
    const probes: MTestProbe[] = []
    const seen = new Set<string>()
    for (const value of parsed.probes) {
      if (!value || typeof value !== 'object' || typeof value.model !== 'string' || seen.has(value.model)) return null
      seen.add(value.model)
      const ping = value.ping && typeof value.ping === 'object' && typeof value.ping.ok === 'boolean' && typeof value.ping.http_code === 'number' ? { ok: value.ping.ok, http_code: value.ping.http_code } : null
      probes.push({ model: value.model, ping, latency: value.latency && typeof value.latency === 'object' && !Array.isArray(value.latency) ? value.latency : null })
    }
    return probes
  } catch { return null }
}

function failureResult(mapping: ProviderModel, error: string): ProbeInsert {
  return { providerId: mapping.providerId, modelId: mapping.modelId, providerModelId: mapping.providerModelId, modelRevision: mapping.modelRevision, ts: Date.now(), pingOk: null, httpCode: null, ttftMs: null, totalMs: null, tokens: null, ratePerSec: null, contextWindow: null, maxOutput: null, caps: null, error }
}

function mapProbe(mapping: ProviderModel, probe: MTestProbe): ProbeInsert {
  const ttft = measurement(probe.latency?.ttft_secs)
  const total = measurement(probe.latency?.total_secs)
  return { ...failureResult(mapping, ''), pingOk: probe.ping?.ok ?? null, httpCode: probe.ping?.http_code ?? null,
    ttftMs: ttft === null ? null : ttft * 1000, totalMs: total === null ? null : total * 1000,
    tokens: measurement(probe.latency?.tokens), ratePerSec: measurement(probe.latency?.rate_per_sec),
    error: probe.ping?.ok !== true ? 'Probe availability check failed' : ttft === null || total === null ? 'Probe returned no complete latency measurement' : null }
}

/** Transparent transport only: mtest owns requests, streaming parsing and measurements. */
async function createRelay(target: { apiBaseUrl: string; apiKey: string }, models: Set<string>, timeoutMs: number, signal: AbortSignal): Promise<ProbeRelay> {
  const targetUrl = new URL(target.apiBaseUrl)
  const basePath = targetUrl.pathname === '/' ? '' : targetUrl.pathname.replace(/\/+$/, '')
  const lookup = await createSafeLookup(targetUrl)
  const relayKey = randomBytes(32).toString('hex')
  const httpAgent = new HttpAgent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 60000 })
  const httpsAgent = new HttpsAgent({ keepAlive: true, maxSockets: 32, keepAliveMsecs: 60000 })
  const requests = new Set<ClientRequest>()
  const failedModels = new Set<string>()
  const server = createServer((incoming, outgoing) => {
    const path = incoming.url || ''
    if (incoming.headers.authorization !== `Bearer ${relayKey}` || !((incoming.method === 'GET' && (path === '/v1/models' || path === '/models')) || (incoming.method === 'POST' && (path === '/v1/chat/completions' || path === '/chat/completions')))) {
      outgoing.writeHead(403).end()
      return
    }
    let model: string | null = null
    let streaming = false
    let complete = false
    const fail = () => { if (model && !complete) failedModels.add(model) }
    const subpath = path.startsWith('/v1/') ? path.slice(3) : path
    const destination = new URL(`${basePath}${subpath}`, targetUrl.origin)
    const request = (destination.protocol === 'https:' ? httpsRequest : httpRequest)(destination, {
      method: incoming.method, lookup, agent: destination.protocol === 'https:' ? httpsAgent : httpAgent,
      headers: { authorization: `Bearer ${target.apiKey}`, 'content-type': 'application/json', accept: incoming.headers.accept || '*/*', 'accept-encoding': 'identity' },
    }, (response) => {
      let sawDone = false
      let tail = ''
      if ((response.statusCode || 502) >= 400) fail()
      response.on('data', (chunk: Buffer) => {
        if (!streaming || sawDone) return
        // Check only protocol completion; all timing/token measurements remain in mtest.
        const text = tail + chunk.toString('utf8')
        sawDone = /(?:^|\n)data:\s*\[DONE\](?:\r?\n|$)/.test(text)
        tail = text.slice(-64)
      })
      response.on('end', () => {
        if (!response.complete || (streaming && !sawDone)) fail()
        complete = true
      })
      if ((response.statusCode || 502) >= 300 && (response.statusCode || 502) < 400) {
        fail()
        response.destroy()
        outgoing.writeHead(502).end()
        return
      }
      outgoing.writeHead(response.statusCode || 502, { 'content-type': response.headers['content-type'] || 'application/json' })
      outgoing.flushHeaders()
      response.on('error', () => { fail(); outgoing.destroy() })
      response.pipe(outgoing)
    })
    requests.add(request)
    const timeout = setTimeout(() => { fail(); request.destroy() }, timeoutMs)
    request.on('close', () => { clearTimeout(timeout); requests.delete(request) })
    request.on('error', () => { fail(); if (!outgoing.headersSent) outgoing.writeHead(502).end(); else outgoing.destroy() })
    incoming.on('aborted', () => { fail(); request.destroy() })
    outgoing.on('close', () => { fail(); request.destroy() })
    if (incoming.method === 'GET') incoming.pipe(request)
    else {
      const chunks: Buffer[] = []
      let bytes = 0
      incoming.on('data', (chunk: Buffer) => {
        bytes += chunk.length
        if (bytes > 64 * 1024) { request.destroy(); incoming.destroy() }
        else chunks.push(chunk)
      })
      incoming.on('end', () => {
        try {
          const body = Buffer.concat(chunks)
          const parsed = JSON.parse(body.toString('utf8')) as { model?: unknown; stream?: unknown }
          if (!parsed || typeof parsed.model !== 'string' || !models.has(parsed.model)) {
            outgoing.writeHead(403).end()
            request.destroy()
            return
          }
          model = parsed.model
          streaming = parsed.stream === true
          request.end(body)
        } catch {
          outgoing.writeHead(400).end()
          request.destroy()
        }
      })
    }
  })
  server.requestTimeout = timeoutMs
  server.headersTimeout = Math.min(timeoutMs, 10_000)
  const stop = () => { for (const request of requests) request.destroy(); server.closeAllConnections() }
  signal.addEventListener('abort', stop, { once: true })
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    if (signal.aborted) throw new Error('Probe cancelled')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Probe transport unavailable')
    return { baseUrl: `http://127.0.0.1:${address.port}`, apiKey: relayKey, failedModels, close: async () => {
      signal.removeEventListener('abort', stop)
      stop()
      httpAgent.destroy()
      httpsAgent.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    } }
  } catch {
    signal.removeEventListener('abort', stop)
    stop()
    httpAgent.destroy()
    httpsAgent.destroy()
    server.close()
    throw new Error('Probe transport unavailable')
  }
}

// This watchdog survives a worker crash and kills mtest before its SQLite lease can expire.
// Its stdin pipe also closes on parent death. It is process supervision, not a probe engine.
const WATCHDOG = `
const { spawn } = require('node:child_process');
const [deadline, binary, ...args] = process.argv.slice(1);
if (Date.now() >= Number(deadline)) process.exit(1);
const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.pipe(process.stdout); child.stderr.resume();
const stop = () => child.kill('SIGKILL');
const timer = setTimeout(stop, Math.max(1, Number(deadline) - Date.now()));
process.stdin.resume(); process.stdin.on('end', stop);
process.on('SIGTERM', stop); process.on('SIGINT', stop);
child.on('error', () => { clearTimeout(timer); process.exit(2); });
child.on('close', (code) => { clearTimeout(timer); process.stdout.write('', () => process.exit(code === null ? 2 : code)); });
`

async function runBatch(mappings: ProviderModel[], lease: RunLease, signal: AbortSignal, extend: (horizonMs: number) => number | null): Promise<ProbeInsert[]> {
  const provider = mappings[0]
  if (!provider) return []
  let target: { apiBaseUrl: string; apiKey: string }
  try { target = await prepareProviderTarget(provider.providerId) }
  catch { return mappings.map((mapping) => failureResult(mapping, 'Configuration: provider credentials or endpoint unavailable')) }
  if (signal.aborted) return mappings.map((mapping) => failureResult(mapping, 'Probe cancelled'))
  const settings = lease.settings
  // Discovery, then two calls/model; batches never exceed the global concurrency limit.
  const timeoutMs = (1 + 2 * Math.ceil(mappings.length / settings.concurrency)) * settings.timeoutSeconds * 1000 + 15_000
  const expiry = extend(timeoutMs + 30_000)
  if (expiry === null) return mappings.map((mapping) => failureResult(mapping, 'Worker lease lost'))
  const deadline = Math.min(Date.now() + timeoutMs, expiry - 15_000)
  const directory = mkdtempSync(join(tmpdir(), 'probelm-probe-'))
  let relay: ProbeRelay | null = null
  try {
    relay = await createRelay(target, new Set(mappings.map((mapping) => mapping.providerModelId)), settings.timeoutSeconds * 1000, signal)
    const configPath = join(directory, 'config.json')
    writeFileSync(configPath, JSON.stringify({ endpoint: { baseUrl: relay.baseUrl, apiKey: relay.apiKey }, models: mappings.map((mapping) => mapping.providerModelId), defaultPrompt: settings.prompt, maxTokens: settings.maxTokens, temperature: settings.temperature, timeoutSeconds: settings.timeoutSeconds }), { mode: 0o600 })
    // Deliberate allowlist: no ROUTER_*, proxy variables, inherited provider keys, NODE_OPTIONS or global mtest config.
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', HOME: directory, TMPDIR: directory, LANG: 'C.UTF-8' }
    let stdout: string
    let reportedFailure = false
    try {
      const result = await execFileAsync(process.execPath, ['-e', WATCHDOG, String(deadline), MTEST, 'test', '--config', configPath, '--json', '--jobs', String(Math.min(settings.concurrency, mappings.length))], { env, cwd: directory, signal, timeout: Math.max(1, deadline - Date.now()) + 5000, maxBuffer: 16 * 1024 * 1024 })
      stdout = String(result.stdout)
    } catch (cause) {
      const error = cause as { code?: unknown; stdout?: unknown }
      // mtest uses exit 1 for per-model ping failures, not CLI failure (exit 2).
      if (error.code !== 1 || typeof error.stdout !== 'string') throw cause
      stdout = error.stdout
      reportedFailure = true
    }
    const probes = parseOutput(stdout)
    if (!probes) return mappings.map((mapping) => failureResult(mapping, 'Probe engine returned invalid output'))
    if (reportedFailure && probes.every((probe) => probe.ping?.ok === true)) return mappings.map((mapping) => failureResult(mapping, 'Probe engine execution failed'))
    const byModel = new Map(probes.map((probe) => [probe.model, probe]))
    const failedModels = relay.failedModels
    return mappings.map((mapping) => {
      if (failedModels.has(mapping.providerModelId)) return failureResult(mapping, 'Probe transport or streaming response was incomplete')
      const probe = byModel.get(mapping.providerModelId)
      return probe ? mapProbe(mapping, probe) : failureResult(mapping, 'Probe engine returned no result')
    })
  } catch {
    return mappings.map((mapping) => failureResult(mapping, signal.aborted ? 'Probe cancelled' : 'Probe engine execution failed'))
  } finally {
    if (relay) await relay.close()
    rmSync(directory, { recursive: true, force: true })
  }
}

/** External entrypoints only. Both scheduled and one-shot workers use the same fenced lease. */
export async function runProbe(options: WorkerOptions = {}): Promise<RunResult> {
  if (options.signal?.aborted) return { runId: null, modelCount: 0, status: 'skipped', error: null }
  const lease = acquireRun(options.trigger || 'external', options.scheduled === true)
  if (!lease) return { runId: null, modelCount: 0, status: 'skipped', error: null }
  const controller = new AbortController()
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  let horizonMs = 60_000
  const extend = (horizon: number) => {
    horizonMs = horizon
    const expiry = renewRun(lease, horizonMs)
    if (expiry === null) controller.abort()
    return expiry
  }
  const heartbeat = setInterval(() => { try { extend(horizonMs) } catch { controller.abort() } }, 10_000)
  const results: ProbeInsert[] = []
  try {
    const providers = new Map<number, ProviderModel[]>()
    for (const mapping of lease.mappings) {
      const group = providers.get(mapping.providerId)
      if (group) group.push(mapping)
      else providers.set(mapping.providerId, [mapping])
    }
    for (const mappings of providers.values()) {
      for (let offset = 0; offset < mappings.length; offset += lease.settings.concurrency) {
        const batch = mappings.slice(offset, offset + lease.settings.concurrency)
        if (controller.signal.aborted) results.push(...batch.map((mapping) => failureResult(mapping, 'Probe cancelled')))
        else results.push(...await runBatch(batch, lease, controller.signal, extend))
      }
    }
    const successes = results.filter((result) => result.error === null && result.pingOk === true && result.ttftMs !== null && result.totalMs !== null).length
    const status = successes === 0 ? 'failed' : successes < results.length ? 'degraded' : 'completed'
    const error = results.length === 0 ? 'No enabled provider models configured' : status === 'completed' ? null : `${results.length - successes} probe result(s) failed`
    if (!completeRun(lease, status, results, error)) return { runId: lease.runId, modelCount: 0, status: 'failed', error: 'Worker lease lost; results discarded' }
    return { runId: lease.runId, modelCount: results.length, status, error }
  } catch {
    const error = 'Worker execution failed'
    completeRun(lease, 'failed', results, error)
    return { runId: lease.runId, modelCount: results.length, status: 'failed', error }
  } finally {
    clearInterval(heartbeat)
    options.signal?.removeEventListener('abort', abort)
  }
}
