import { createHash, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createError, deleteCookie, getCookie, getHeader, getRequestURL, setCookie, type H3Event } from 'h3'
import type { AuthState } from '../../shared/types'
import { getDb } from './db'

const deriveKey = promisify(scrypt)
const SESSION_COOKIE = 'probelm_session'
const SESSION_MS = 12 * 60 * 60 * 1000
let initialized = false
interface SessionRow { token_hash: string; csrf_token: string; user_id: number; username: string; must_change_password: number }
interface UserRow { id: number; username: string; password_hash: string; must_change_password: number }

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

function ensureAuth() {
  if (initialized) return
  const db = getDb()
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      must_change_password INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES admin_users(id),
      csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_login_attempts (
      bucket TEXT PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL
    );
  `)
  db.transaction(() => {
    if (!db.prepare('SELECT id FROM admin_users LIMIT 1').get()) {
      db.prepare('INSERT INTO admin_users (username,password_hash,must_change_password,updated_at) VALUES (?,?,1,?)')
        .run(process.env.ADMIN_INITIAL_USERNAME || 'admin', hashPassword(process.env.ADMIN_INITIAL_PASSWORD || 'piknik'), Date.now())
    }
  }).immediate()
  initialized = true
}

export function requireSameOrigin(event: H3Event) {
  const origin = getHeader(event, 'origin')
  const url = getRequestURL(event, { xForwardedHost: false, xForwardedProto: false })
  const expected = process.env.APP_ORIGIN || `${process.env.COOKIE_SECURE === 'true' ? 'https:' : url.protocol}//${url.host}`
  if (!origin || origin !== expected || getHeader(event, 'sec-fetch-site') === 'cross-site') {
    throw createError({ statusCode: 403, statusMessage: 'Same-origin request required' })
  }
}

function readSession(event: H3Event): SessionRow | null {
  ensureAuth()
  const token = getCookie(event, SESSION_COOKIE)
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null
  return getDb().prepare(`SELECT s.token_hash,s.csrf_token,s.user_id,u.username,u.must_change_password
    FROM admin_sessions s JOIN admin_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`)
    .get(createHash('sha256').update(token).digest('hex'), Date.now()) as SessionRow | undefined || null
}

export function getAuthState(event: H3Event): AuthState {
  const session = readSession(event)
  return session ? { user: { username: session.username, mustChangePassword: !!session.must_change_password }, csrfToken: session.csrf_token }
    : { user: null, csrfToken: null }
}

export function requireAdmin(event: H3Event, allowPasswordChange = false): SessionRow {
  const session = readSession(event)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  if (session.must_change_password && !allowPasswordChange) throw createError({ statusCode: 403, statusMessage: 'Password change required' })
  return session
}

export function requireCsrf(event: H3Event) {
  requireSameOrigin(event)
  const session = requireAdmin(event, true)
  const token = getHeader(event, 'x-csrf-token') || ''
  if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(session.csrf_token))) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid CSRF token' })
  }
}

function createSession(event: H3Event, userId: number): AuthState {
  const csrfToken = randomBytes(32).toString('hex')
  const token = randomBytes(32).toString('hex')
  getDb().prepare('DELETE FROM admin_sessions WHERE expires_at<=?').run(Date.now())
  getDb().prepare('INSERT INTO admin_sessions (token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)')
    .run(createHash('sha256').update(token).digest('hex'), userId, csrfToken, Date.now() + SESSION_MS)
  setCookie(event, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: process.env.COOKIE_SECURE !== 'false' && (process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production'), path: '/', maxAge: SESSION_MS / 1000 })
  const user = getDb().prepare('SELECT username,must_change_password FROM admin_users WHERE id=?').get(userId) as UserRow
  return { user: { username: user.username, mustChangePassword: !!user.must_change_password }, csrfToken }
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [salt, hash] = encoded.split(':')
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false
  const actual = await deriveKey(password, salt, 64) as Buffer
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}

export async function login(event: H3Event, input: unknown): Promise<AuthState> {
  requireSameOrigin(event)
  ensureAuth()
  if (!input || typeof input !== 'object' || !('username' in input) || !('password' in input)
    || typeof input.username !== 'string' || typeof input.password !== 'string'
    || input.username.length > 128 || input.password.length > 1024) throw createError({ statusCode: 400, statusMessage: 'Invalid login input' })
  const db = getDb()
  const now = Date.now()
  const buckets = [`ip:${event.node.req.socket.remoteAddress || 'unknown'}`, `user:${input.username}`]
  db.prepare('DELETE FROM admin_login_attempts WHERE reset_at<=?').run(now)
  const limited = db.transaction(() => {
    for (const bucket of buckets) {
      const row = db.prepare('SELECT failures FROM admin_login_attempts WHERE bucket=?').get(bucket) as { failures: number } | undefined
      if (row && row.failures >= 10) return true
    }
    for (const bucket of buckets) db.prepare(`INSERT INTO admin_login_attempts (bucket,failures,reset_at) VALUES (?,1,?)
      ON CONFLICT(bucket) DO UPDATE SET failures=failures+1`).run(bucket, now + 15 * 60 * 1000)
    return false
  }).immediate()
  if (limited) throw createError({ statusCode: 429, statusMessage: 'Too many login attempts; try again later' })
  const user = db.prepare('SELECT * FROM admin_users WHERE username=?').get(input.username) as UserRow | undefined
  const valid = await verifyPassword(input.password, user?.password_hash || `${'0'.repeat(32)}:${'0'.repeat(128)}`)
  if (!user || !valid) throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  if (!db.prepare('SELECT id FROM admin_users WHERE id=? AND password_hash=?').get(user.id, user.password_hash)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid username or password' })
  }
  for (const bucket of buckets) db.prepare('DELETE FROM admin_login_attempts WHERE bucket=?').run(bucket)
  const previous = readSession(event)
  if (previous) db.prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(previous.token_hash)
  return createSession(event, user.id)
}

export async function changePassword(event: H3Event, input: unknown): Promise<AuthState> {
  requireCsrf(event)
  const session = requireAdmin(event, true)
  if (!input || typeof input !== 'object' || !('currentPassword' in input) || !('newPassword' in input)
    || typeof input.currentPassword !== 'string' || typeof input.newPassword !== 'string'
    || input.currentPassword.length > 1024 || input.newPassword.length < 12 || input.newPassword.length > 1024
    || input.currentPassword === input.newPassword) throw createError({ statusCode: 400, statusMessage: 'Use a different password between 12 and 1024 characters' })
  const db = getDb()
  const user = db.prepare('SELECT * FROM admin_users WHERE id=?').get(session.user_id) as UserRow
  if (!await verifyPassword(input.currentPassword, user.password_hash)) throw createError({ statusCode: 403, statusMessage: 'Current password is incorrect' })
  const salt = randomBytes(16).toString('hex')
  const key = await deriveKey(input.newPassword, salt, 64) as Buffer
  db.transaction(() => {
    const result = db.prepare('UPDATE admin_users SET password_hash=?,must_change_password=0,updated_at=? WHERE id=? AND password_hash=?')
      .run(`${salt}:${key.toString('hex')}`, Date.now(), user.id, user.password_hash)
    if (!result.changes) throw createError({ statusCode: 409, statusMessage: 'Password changed; sign in again' })
    db.prepare('DELETE FROM admin_sessions WHERE user_id=?').run(user.id)
  }).immediate()
  return createSession(event, user.id)
}

export function logout(event: H3Event): AuthState {
  requireCsrf(event)
  const session = requireAdmin(event, true)
  getDb().prepare('DELETE FROM admin_sessions WHERE token_hash=?').run(session.token_hash)
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  return { user: null, csrfToken: null }
}
