import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { initializeMonitoringSchema } from './scheduler'

export type RunStatus = 'running' | 'completed' | 'degraded' | 'failed'


export interface ProviderModel {
  id: number
  providerId: number
  providerName: string
  providerSlug: string
  providerBaseUrl: string
  apiKeyEnv: string
  modelId: number
  canonicalName: string
  displayName: string
  providerModelId: string
  modelRevision: string | null
  enabled: boolean
}


export interface ProbeInsert {
  providerId: number
  modelId: number
  providerModelId: string
  ts?: number
  modelRevision?: string | null
  pingOk: boolean | null
  httpCode: number | null
  ttftMs: number | null
  totalMs: number | null
  tokens: number | null
  ratePerSec: number | null
  contextWindow: number | null
  maxOutput: number | null
  caps: Record<string, unknown> | null
  error: string | null
}


const DB_PATH = process.env.PROBE_DB || join(homedir(), '.config', 'probelm', 'dashboard.db')
const SCHEMA_VERSION = '3'
let db: Database.Database | null = null

function ensureDir(path: string) {
  const slash = path.lastIndexOf('/')
  if (slash > 0) mkdirSync(path.slice(0, slash), { recursive: true })
}

function tableExists(database: Database.Database, name: string): boolean {
  const row = database
    .prepare("SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { present?: number } | undefined
  return row?.present === 1
}

function readLegacyConfig(): { baseUrl: string; models: string[] } {
  const path = join(homedir(), '.config', 'probelm', 'config.json')
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return { baseUrl: 'http://localhost:20128', models: [] }
    const value = parsed as Record<string, unknown>
    const endpoint = value.endpoint && typeof value.endpoint === 'object'
      ? value.endpoint as Record<string, unknown>
      : {}
    const models = Array.isArray(value.models)
      ? value.models.filter((item): item is string => typeof item === 'string')
      : []
    return {
      baseUrl: typeof endpoint.baseUrl === 'string' ? endpoint.baseUrl : 'http://localhost:20128',
      models,
    }
  } catch {
    return { baseUrl: 'http://localhost:20128', models: [] }
  }
}

function initializeSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS providers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'openai-compatible',
      base_url TEXT NOT NULL,
      api_key_env TEXT NOT NULL,
      icon_url TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS monitored_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon_key TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS provider_models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      model_id INTEGER NOT NULL REFERENCES monitored_models(id),
      provider_model_id TEXT NOT NULL,
      model_revision TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(provider_id, model_id),
      UNIQUE(provider_id, provider_model_id)
    );
    CREATE TABLE IF NOT EXISTS probe_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scheduled_at INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      status TEXT NOT NULL,
      trigger TEXT NOT NULL,
      expected_count INTEGER NOT NULL,
      completed_count INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      profile_version TEXT NOT NULL,
      runner_version TEXT NOT NULL,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS probe_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL REFERENCES probe_runs(id),
      provider_id INTEGER NOT NULL REFERENCES providers(id),
      model_id INTEGER NOT NULL REFERENCES monitored_models(id),
      provider_model_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      ping_ok INTEGER,
      http_code INTEGER,
      ttft_ms REAL,
      total_ms REAL,
      tokens INTEGER,
      rate_per_sec REAL,
      context_window INTEGER,
      max_output INTEGER,
      capabilities TEXT,
      error TEXT,
      UNIQUE(run_id, provider_id, model_id)
    );
    CREATE INDEX IF NOT EXISTS idx_provider_model_ts ON probe_results(provider_id, model_id, ts);
    CREATE INDEX IF NOT EXISTS idx_probe_results_ts ON probe_results(ts);
    CREATE INDEX IF NOT EXISTS idx_probe_runs_scheduled ON probe_runs(scheduled_at);
  `)
  // Serialize first-start migrations across the web and worker processes.
  database.transaction(() => {
    migrateLegacy(database)
    const columns = database.prepare('PRAGMA table_info(probe_runs)').all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === 'profile_config')) {
      database.exec('ALTER TABLE probe_runs ADD COLUMN profile_config TEXT')
    }
    const resultColumns = database.prepare('PRAGMA table_info(probe_results)').all() as Array<{ name: string }>
    if (!resultColumns.some((column) => column.name === 'model_revision')) {
      database.exec('ALTER TABLE probe_results ADD COLUMN model_revision TEXT')
    }
    const providerCols = database.prepare('PRAGMA table_info(providers)').all() as Array<{ name: string }>
    if (!providerCols.some((col) => col.name === 'icon_url')) {
      database.exec('ALTER TABLE providers ADD COLUMN icon_url TEXT')
    }
    const modelCols = database.prepare('PRAGMA table_info(monitored_models)').all() as Array<{ name: string }>
    if (!modelCols.some((col) => col.name === 'icon_key')) {
      database.exec('ALTER TABLE monitored_models ADD COLUMN icon_key TEXT')
    }
    database.exec('CREATE INDEX IF NOT EXISTS idx_model_history ON probe_results(model_id, ts, id)')
    database.exec('CREATE INDEX IF NOT EXISTS idx_result_identity ON probe_results(provider_id, model_id, provider_model_id, model_revision, id DESC)')
    const mappingVersion = database.prepare("SELECT value FROM schema_meta WHERE key = 'mapping_archive'").get()
    if (!mappingVersion) {
      database.exec(`
        CREATE TABLE provider_models_archive_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          provider_id INTEGER NOT NULL REFERENCES providers(id),
          model_id INTEGER NOT NULL REFERENCES monitored_models(id),
          provider_model_id TEXT NOT NULL,
          model_revision TEXT,
          enabled INTEGER NOT NULL DEFAULT 1
        );
        INSERT INTO provider_models_archive_migration SELECT * FROM provider_models;
        DROP TABLE provider_models;
        ALTER TABLE provider_models_archive_migration RENAME TO provider_models;
        CREATE UNIQUE INDEX idx_active_provider_model ON provider_models(provider_id, model_id) WHERE enabled = 1;
        CREATE UNIQUE INDEX idx_active_provider_model_id ON provider_models(provider_id, provider_model_id) WHERE enabled = 1;
        INSERT INTO schema_meta(key,value) VALUES ('mapping_archive','1');
      `)
    }
    initializeMonitoringSchema(database)
  }).immediate()
}

function migrateLegacy(database: Database.Database) {
  const marker = database.prepare('SELECT value FROM schema_meta WHERE key = ?').get('schema_version') as { value?: string } | undefined
  if (marker?.value === SCHEMA_VERSION) return

  const cfg = readLegacyConfig()
  const now = Date.now()
  const existingProvider = database.prepare('SELECT id FROM providers ORDER BY id LIMIT 1').get() as { id: number } | undefined
  const providerId = existingProvider?.id ?? Number(database.prepare(`
    INSERT INTO providers (name, slug, kind, base_url, api_key_env, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `).run('9Router', '9router', 'openai-compatible', cfg.baseUrl, 'ROUTER_KEY', now, now).lastInsertRowid)

  const ensureModel = database.prepare(`
    INSERT INTO monitored_models (canonical_name, display_name, enabled)
    VALUES (?, ?, 1)
    ON CONFLICT(canonical_name) DO NOTHING
  `)
  const getModel = database.prepare('SELECT id FROM monitored_models WHERE canonical_name = ?')
  const ensureMapping = database.prepare(`
    INSERT INTO provider_models (provider_id, model_id, provider_model_id, enabled)
    VALUES (?, ?, ?, 1)
    ON CONFLICT(provider_id, model_id) DO NOTHING
  `)

  for (const model of cfg.models) {
    ensureModel.run(model, model)
    const row = getModel.get(model) as { id: number }
    ensureMapping.run(providerId, row.id, model)
  }

  if (tableExists(database, 'probes') && tableExists(database, 'runs')) {
    const legacyRuns = database.prepare('SELECT * FROM runs ORDER BY ts ASC').all() as Array<{
      id: number
      ts: number
      success: number
      model_count: number
      duration_ms: number
      error: string | null
    }>
    const insertRun = database.prepare(`
      INSERT INTO probe_runs
        (scheduled_at, started_at, finished_at, status, trigger, expected_count, completed_count, duration_ms, profile_version, runner_version, error)
      VALUES (?, ?, ?, ?, 'migration', ?, ?, ?, 'legacy', 'legacy', ?)
    `)
    const legacyProbes = database.prepare('SELECT * FROM probes WHERE ts = ?')
    const insertResult = database.prepare(`
      INSERT OR IGNORE INTO probe_results
        (run_id, provider_id, model_id, provider_model_id, ts, ping_ok, http_code, ttft_ms, total_ms, tokens, rate_per_sec, context_window, max_output, capabilities, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const importRun = database.transaction((legacyRun: typeof legacyRuns[number]) => {
      const status: RunStatus = legacyRun.success ? 'completed' : 'degraded'
      const finish = legacyRun.ts + Math.max(0, legacyRun.duration_ms)
      const runId = Number(insertRun.run(
        legacyRun.ts,
        legacyRun.ts,
        finish,
        status,
        legacyRun.model_count,
        legacyRun.model_count,
        legacyRun.duration_ms,
        legacyRun.error,
      ).lastInsertRowid)
      const rows = legacyProbes.all(legacyRun.ts) as Array<{
        ts: number
        model: string
        ping_ok: number | null
        http_code: number | null
        ttft_ms: number | null
        total_ms: number | null
        tokens: number | null
        rate_per_sec: number | null
        context_window: number | null
        max_output: number | null
        capabilities: string | null
        error: string | null
      }>
      for (const row of rows) {
        ensureModel.run(row.model, row.model)
        const model = getModel.get(row.model) as { id: number }
        ensureMapping.run(providerId, model.id, row.model)
        insertResult.run(
          runId,
          providerId,
          model.id,
          row.model,
          row.ts ?? legacyRun.ts,
          row.ping_ok,
          row.http_code,
          row.ttft_ms,
          row.total_ms,
          row.tokens,
          row.rate_per_sec,
          row.context_window,
          row.max_output,
          row.capabilities,
          row.error,
        )
      }
    })
    for (const legacyRun of legacyRuns) importRun(legacyRun)
  }

  database.prepare(`
    INSERT INTO schema_meta (key, value) VALUES ('schema_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(SCHEMA_VERSION)
}

export function getDb(): Database.Database {
  if (db) return db
  ensureDir(DB_PATH)
  db = new Database(DB_PATH)
  db.pragma('busy_timeout = 10000')
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initializeSchema(db)
  return db
}


export function listProviderModels(providerId?: number, enabledOnly = true): ProviderModel[] {
  const rows = getDb().prepare(`
    SELECT
      pm.id, pm.provider_id, p.name AS provider_name, p.slug AS provider_slug, p.base_url,
      p.api_key_env, pm.model_id, mm.canonical_name, mm.display_name,
      pm.provider_model_id, pm.model_revision, pm.enabled
    FROM provider_models pm
    JOIN providers p ON p.id = pm.provider_id
    JOIN monitored_models mm ON mm.id = pm.model_id
    WHERE (? IS NULL OR pm.provider_id = ?)
      AND (? = 0 OR (pm.enabled = 1 AND p.enabled = 1 AND mm.enabled = 1))
    ORDER BY p.name, mm.canonical_name
  `).all(providerId ?? null, providerId ?? null, enabledOnly ? 1 : 0) as Array<Record<string, unknown>>
  return rows.map((row) => ({
    id: Number(row.id),
    providerId: Number(row.provider_id),
    providerName: String(row.provider_name),
    providerSlug: String(row.provider_slug),
    providerBaseUrl: String(row.base_url),
    apiKeyEnv: String(row.api_key_env),
    modelId: Number(row.model_id),
    canonicalName: String(row.canonical_name),
    displayName: String(row.display_name),
    providerModelId: String(row.provider_model_id),
    modelRevision: row.model_revision == null ? null : String(row.model_revision),
    enabled: Number(row.enabled) === 1,
  }))
}


export function createProbeRun(input: {
  scheduledAt: number
  trigger: string
  expectedCount: number
  profileVersion: string
  runnerVersion: string
  profileConfig?: Record<string, unknown>
}): number {
  const row = getDb().prepare(`
    INSERT INTO probe_runs
      (scheduled_at, started_at, status, trigger, expected_count, completed_count, duration_ms, profile_version, runner_version, profile_config)
    VALUES (?, ?, 'running', ?, ?, 0, 0, ?, ?, ?)
  `).run(input.scheduledAt, Date.now(), input.trigger, input.expectedCount, input.profileVersion, input.runnerVersion, input.profileConfig ? JSON.stringify(input.profileConfig) : null)
  return Number(row.lastInsertRowid)
}

export function finishProbeRun(input: {
  runId: number
  startedAt: number
  status: Exclude<RunStatus, 'running'>
  results: ProbeInsert[]
  error?: string | null
}) {
  const database = getDb()
  const insert = database.prepare(`
    INSERT INTO probe_results
      (run_id, provider_id, model_id, provider_model_id, ts, ping_ok, http_code, ttft_ms, total_ms, tokens, rate_per_sec, context_window, max_output, capabilities, error, model_revision)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const tx = database.transaction(() => {
    const ts = Date.now()
    for (const result of input.results) {
      insert.run(
        input.runId,
        result.providerId,
        result.modelId,
        result.providerModelId,
        result.ts ?? ts,
        result.pingOk === null ? null : result.pingOk ? 1 : 0,
        result.httpCode,
        result.ttftMs,
        result.totalMs,
        result.tokens,
        result.ratePerSec,
        result.contextWindow,
        result.maxOutput,
        result.caps ? JSON.stringify(result.caps) : null,
        result.error,
        result.modelRevision ?? null,
      )
    }
    database.prepare(`
      UPDATE probe_runs
      SET finished_at = ?, status = ?, completed_count = ?, duration_ms = ?, error = ?
      WHERE id = ?
    `).run(ts, input.status, input.results.length, ts - input.startedAt, input.error ?? null, input.runId)
  })
  tx()
}

