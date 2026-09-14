import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

function masterKey(): Buffer {
  const path = process.env.PROBE_MASTER_KEY_FILE
  if (!path) throw new Error('Credential encryption is not configured')
  const key = readFileSync(path)
  if (key.length !== 32) throw new Error('Credential encryption key must contain 32 raw bytes')
  return key
}

export function encryptSecret(value: string): string {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', masterKey(), nonce)
  cipher.setAAD(Buffer.from('probelm-provider-key:v1'))
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return ['v1', nonce.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.')
}

export function decryptSecret(value: string): string {
  const [version, nonce, tag, ciphertext, extra] = value.split('.')
  if (version !== 'v1' || !nonce || !tag || !ciphertext || extra) throw new Error('Invalid stored credential')
  const decipher = createDecipheriv('aes-256-gcm', masterKey(), Buffer.from(nonce, 'base64'))
  decipher.setAAD(Buffer.from('probelm-provider-key:v1'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8')
}
