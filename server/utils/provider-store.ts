import { createError } from 'h3'
import type { AdminProvider, CanonicalModel, CatalogModel, MappingInput, ProviderMapping } from '../../shared/types'
import { getDb } from './db'
import { decryptSecret, encryptSecret } from './secrets'
import { createSafeLookup, normalizeApiBase, safeRequest } from './network'

let initialized = false
interface ProviderRow { id: number; name: string; slug: string; base_url: string; icon_url: string | null; enabled: number; created_at: number; updated_at: number; encrypted_key: string | null; legacy_env: string | null }

function ensureProviderStore() {
  if (initialized) return
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS provider_credentials (
    provider_id INTEGER PRIMARY KEY REFERENCES providers(id), encrypted_key TEXT, legacy_env TEXT
  );
  CREATE TABLE IF NOT EXISTS provider_catalog (
    provider_id INTEGER PRIMARY KEY REFERENCES providers(id), models_json TEXT NOT NULL, updated_at INTEGER NOT NULL
  );`)
  db.transaction(() => {
    if (!db.prepare("SELECT value FROM schema_meta WHERE key='credential_migration'").get()) {
      db.prepare("INSERT OR IGNORE INTO provider_credentials (provider_id,legacy_env) SELECT id,NULLIF(api_key_env,'') FROM providers").run()
      db.prepare("INSERT INTO schema_meta (key,value) VALUES ('credential_migration','1')").run()
    }
  }).immediate()
  initialized = true
}

function providerRow(id: number): ProviderRow {
  ensureProviderStore()
  const row = getDb().prepare(`SELECT p.*,c.encrypted_key,c.legacy_env FROM providers p LEFT JOIN provider_credentials c ON c.provider_id=p.id WHERE p.id=?`).get(id) as ProviderRow | undefined
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Provider not found' })
  return row
}

function adminProvider(row: ProviderRow): AdminProvider {
  let baseUrl = row.base_url
  try { baseUrl = normalizeApiBase(baseUrl) } catch { /* Invalid legacy endpoints remain visible for correction. */ }
  return { id: row.id, name: row.name, slug: row.slug, baseUrl, enabled: !!row.enabled,
    keyConfigured: !!row.encrypted_key || !!(row.legacy_env && process.env[row.legacy_env]), iconUrl: row.icon_url || null, createdAt: row.created_at, updatedAt: row.updated_at }
}

export function listAdminProviders(): { providers: AdminProvider[]; models: ProviderMapping[]; canonicalModels: CanonicalModel[] } {
  ensureProviderStore()
  const db = getDb()
  const providers = (db.prepare('SELECT p.*,c.encrypted_key,c.legacy_env FROM providers p LEFT JOIN provider_credentials c ON c.provider_id=p.id ORDER BY p.name').all() as ProviderRow[]).map(adminProvider)
  const models = db.prepare(`SELECT pm.id,pm.provider_id AS providerId,pm.model_id AS modelId,mm.canonical_name AS canonicalName,
    mm.display_name AS displayName,mm.icon_key AS iconKey,pm.provider_model_id AS providerModelId,pm.model_revision AS modelRevision,pm.enabled
    FROM provider_models pm JOIN monitored_models mm ON mm.id=pm.model_id
    WHERE pm.id=(SELECT other.id FROM provider_models other WHERE other.provider_id=pm.provider_id AND other.model_id=pm.model_id ORDER BY other.enabled DESC,other.id DESC LIMIT 1)
    ORDER BY mm.canonical_name`).all() as Array<Omit<ProviderMapping, 'enabled'> & { enabled: number }>
  const canonicalModels = db.prepare('SELECT id,canonical_name AS canonicalName,display_name AS displayName,icon_key AS iconKey FROM monitored_models ORDER BY canonical_name').all() as CanonicalModel[]
  return { providers, models: models.map(model => ({ ...model, enabled: !!model.enabled })), canonicalModels }
}

function inputObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw createError({ statusCode: 400, statusMessage: 'Invalid input' })
  return input as Record<string, unknown>
}

function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${name}` })
  }
  return value.trim()
}

export async function saveProvider(input: unknown, id?: number): Promise<{ provider: AdminProvider }> {
  ensureProviderStore()
  const value = inputObject(input)
  if (Object.keys(value).some(key => !['name', 'slug', 'baseUrl', 'apiKey', 'enabled', 'iconUrl'].includes(key))) throw createError({ statusCode: 400, statusMessage: 'Unknown provider field' })
  const old = id == null ? null : providerRow(id)
  const name = 'name' in value ? text(value.name, 'provider name', 128) : old?.name
  if (!name) throw createError({ statusCode: 400, statusMessage: 'Provider name is required' })
  const slug = 'slug' in value ? text(value.slug, 'provider slug', 64) : old?.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) throw createError({ statusCode: 400, statusMessage: 'Use a lowercase alphanumeric provider slug' })
  let baseUrl = old?.base_url || ''
  if (!old || 'baseUrl' in value) {
    try {
      baseUrl = normalizeApiBase(text(value.baseUrl, 'provider endpoint', 2048))
      await createSafeLookup(new URL(baseUrl))
    } catch { throw createError({ statusCode: 400, statusMessage: 'Provider endpoint is invalid, unreachable, or not permitted' }) }
  }
  if ('enabled' in value && typeof value.enabled !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Invalid enabled flag' })
  const enabled = typeof value.enabled === 'boolean' ? value.enabled : old ? !!old.enabled : true
  const iconUrl = 'iconUrl' in value ? (value.iconUrl ? text(value.iconUrl, 'icon URL', 2048) : null) : (old ? old.icon_url : null)
  let encrypted: string | undefined
  if ('apiKey' in value) {
    const key = text(value.apiKey, 'API key', 8192)
    if (/\s/.test(key)) throw createError({ statusCode: 400, statusMessage: 'Invalid API key' })
    try { encrypted = encryptSecret(key) } catch { throw createError({ statusCode: 503, statusMessage: 'Credential encryption is unavailable' }) }
  }
  const db = getDb()
  let providerId: number
  try {
    providerId = db.transaction(() => {
      const now = Date.now()
      const targetId = old?.id ?? Number(db.prepare(`INSERT INTO providers (name,slug,base_url,api_key_env,icon_url,enabled,created_at,updated_at) VALUES (?,?,?,'',?,?,?,?)`).run(name, slug, baseUrl, iconUrl, enabled ? 1 : 0, now, now).lastInsertRowid)
      if (old) db.prepare('UPDATE providers SET name=?,slug=?,base_url=?,icon_url=?,enabled=?,updated_at=? WHERE id=?').run(name, slug, baseUrl, iconUrl, enabled ? 1 : 0, now, targetId)
      if (encrypted !== undefined) {
        db.prepare(`INSERT INTO provider_credentials (provider_id,encrypted_key,legacy_env) VALUES (?,?,NULL)
          ON CONFLICT(provider_id) DO UPDATE SET encrypted_key=excluded.encrypted_key,legacy_env=NULL`).run(targetId, encrypted)
        db.prepare("UPDATE providers SET api_key_env='' WHERE id=?").run(targetId)
      }
      if (old && old.base_url !== baseUrl) db.prepare('DELETE FROM provider_catalog WHERE provider_id=?').run(targetId)
      return targetId
    }).immediate()
  } catch (error) {
    if (error instanceof Error && 'code' in error && String(error.code).startsWith('SQLITE_CONSTRAINT')) throw createError({ statusCode: 409, statusMessage: 'Provider slug already exists' })
    throw createError({ statusCode: 500, statusMessage: 'Unable to save provider' })
  }
  return { provider: adminProvider(providerRow(providerId)) }
}

export async function prepareProviderTarget(providerId: number): Promise<{ apiBaseUrl: string; apiKey: string }> {
  const initial = providerRow(providerId)
  const apiBaseUrl = normalizeApiBase(initial.base_url)
  await createSafeLookup(new URL(apiBaseUrl))
  const row = providerRow(providerId)
  if (row.base_url !== initial.base_url) throw new Error('Provider configuration changed')
  let apiKey: string
  if (row.encrypted_key) apiKey = decryptSecret(row.encrypted_key)
  else {
    const legacyKey = row.legacy_env ? process.env[row.legacy_env] : undefined
    if (!legacyKey) throw new Error('Provider credential is not configured')
    apiKey = legacyKey
    const encrypted = encryptSecret(apiKey)
    getDb().transaction(() => {
      getDb().prepare('UPDATE provider_credentials SET encrypted_key=?,legacy_env=NULL WHERE provider_id=? AND encrypted_key IS NULL').run(encrypted, providerId)
      getDb().prepare("UPDATE providers SET api_key_env='' WHERE id=?").run(providerId)
    }).immediate()
  }
  if (!apiKey || apiKey.length > 8192 || /[\x00-\x20\x7f]/.test(apiKey)) throw new Error('Provider credential is invalid')
  return { apiBaseUrl, apiKey }
}

export function saveProviderMappings(providerId: number, input: unknown): { models: ProviderMapping[] } {
  providerRow(providerId)
  const value = inputObject(input)
  if (!Array.isArray(value.models) || value.models.length > 1000) throw createError({ statusCode: 400, statusMessage: 'Invalid models list' })
  const canonicalNames = new Set<string>()
  const upstreamIds = new Set<string>()
  const models: MappingInput[] = value.models.map(item => {
    const entry = inputObject(item)
    if ('enabled' in entry && typeof entry.enabled !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Invalid model enabled flag' })
    const canonicalName = text(entry.canonicalName, 'canonical model name')
    const providerModelId = text(entry.providerModelId, 'provider model ID')
    if (canonicalNames.has(canonicalName) || upstreamIds.has(providerModelId)) throw createError({ statusCode: 400, statusMessage: 'Duplicate model mapping' })
    canonicalNames.add(canonicalName); upstreamIds.add(providerModelId)
    const iconKey = 'iconKey' in entry && typeof entry.iconKey === 'string' && entry.iconKey.trim() ? text(entry.iconKey, 'icon key', 64) : null
    return { canonicalName, providerModelId, displayName: entry.displayName === undefined ? canonicalName : text(entry.displayName, 'model display name'),
      modelRevision: entry.modelRevision == null || entry.modelRevision === '' ? null : text(entry.modelRevision, 'model revision'), enabled: entry.enabled !== false, iconKey }
  })
  const db = getDb()
  try {
  db.transaction(() => {
    db.prepare('UPDATE provider_models SET enabled=0 WHERE provider_id=?').run(providerId)
    for (const model of models) {
      db.prepare(`INSERT INTO monitored_models (canonical_name,display_name,icon_key,enabled) VALUES (?,?,?,1)
        ON CONFLICT(canonical_name) DO UPDATE SET display_name=excluded.display_name,icon_key=COALESCE(excluded.icon_key,monitored_models.icon_key),enabled=1`).run(model.canonicalName, model.displayName, model.iconKey || null)
      const canonical = db.prepare('SELECT id FROM monitored_models WHERE canonical_name=?').get(model.canonicalName) as { id: number }
      const existing = db.prepare('SELECT id FROM provider_models WHERE provider_id=? AND model_id=? AND provider_model_id=? AND model_revision IS ? ORDER BY id DESC LIMIT 1')
        .get(providerId, canonical.id, model.providerModelId, model.modelRevision) as { id: number } | undefined
      if (existing) db.prepare('UPDATE provider_models SET enabled=? WHERE id=?').run(model.enabled ? 1 : 0, existing.id)
      else db.prepare('INSERT INTO provider_models (provider_id,model_id,provider_model_id,model_revision,enabled) VALUES (?,?,?,?,?)')
        .run(providerId, canonical.id, model.providerModelId, model.modelRevision, model.enabled ? 1 : 0)
    }
    db.prepare('UPDATE providers SET updated_at=? WHERE id=?').run(Date.now(), providerId)
  }).immediate()
  } catch { throw createError({ statusCode: 500, statusMessage: 'Unable to save provider models' }) }
  return { models: listAdminProviders().models.filter(model => model.providerId === providerId) }
}

export async function fetchProviderCatalog(providerId: number): Promise<CatalogModel[]> {
  try {
    const target = await prepareProviderTarget(providerId)
    const response = await safeRequest(new URL(`${target.apiBaseUrl}/models`), { headers: { Authorization: `Bearer ${target.apiKey}`, Accept: 'application/json' } })
    if (response.status < 200 || response.status >= 300) throw new Error('Catalog request failed')
    const body: unknown = JSON.parse(response.body)
    if (!body || typeof body !== 'object' || !('data' in body) || !Array.isArray(body.data) || body.data.length > 10000) throw new Error('Invalid model catalog')
    const models = new Map<string, CatalogModel>()
    for (const item of body.data) {
      if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id || item.id.length > 256) continue
      models.set(item.id, { id: item.id, name: typeof item.name === 'string' && item.name.length <= 256 ? item.name : item.id,
        contextWindow: typeof item.context_window === 'number' && Number.isSafeInteger(item.context_window) && item.context_window > 0 ? item.context_window : null })
    }
    return [...models.values()].sort((a, b) => a.id.localeCompare(b.id))
  } catch { throw createError({ statusCode: 502, statusMessage: 'Unable to read provider catalog; check endpoint, credentials, and network policy' }) }
}

export function getProviderCatalog(providerId: number): { models: CatalogModel[] } {
  providerRow(providerId)
  const row = getDb().prepare('SELECT models_json FROM provider_catalog WHERE provider_id=?').get(providerId) as { models_json: string } | undefined
  return { models: row ? JSON.parse(row.models_json) as CatalogModel[] : [] }
}

export async function syncProviderCatalog(providerId: number): Promise<{ models: CatalogModel[] }> {
  const models = await fetchProviderCatalog(providerId)
  getDb().prepare(`INSERT INTO provider_catalog (provider_id,models_json,updated_at) VALUES (?,?,?)
    ON CONFLICT(provider_id) DO UPDATE SET models_json=excluded.models_json,updated_at=excluded.updated_at`).run(providerId, JSON.stringify(models), Date.now())
  return { models }
}
