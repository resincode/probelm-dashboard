import { createHash, randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { MonitoringSettings, MonitoringState } from '../../shared/types'
import { createProbeRun, finishProbeRun, getDb, listProviderModels, type ProbeInsert, type ProviderModel, type RunStatus } from './db'

const DEFAULTS: MonitoringSettings = { enabled: true, intervalMinutes: 5, prompt: 'Reply with exactly: OK', maxTokens: 64, temperature: 0, timeoutSeconds: 120, concurrency: 4, slowThresholdMs: 3000, dateFormat: 'DD/MM/YYYY' }
const RUNNER_VERSION = 'mtest-worker-v3'
const MIN_LEASE_MS = 60_000

export function profileConfig(settings: MonitoringSettings): Record<string, unknown> {
  return { ...settings, engine: 'mtest', transport: 'openai-compatible-stream via DNS-pinned loopback relay', streamCompletion: 'HTTP framing and SSE DONE required', ttft: 'first streamed content or reasoning token, including local relay overhead', tokens: 'mtest-reported; may be estimated', throughput: 'mtest-reported tokens per second', runnerVersion: RUNNER_VERSION }
}
export function profileVersion(settings: MonitoringSettings): string {
  return `mtest-v3-${createHash('sha256').update(JSON.stringify(profileConfig(settings))).digest('hex').slice(0, 16)}`
}

/** Called from getDb after the base schema migration; never accesses getDb itself. */
export function initializeMonitoringSchema(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS monitoring_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), config TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS worker_schedule (
      id INTEGER PRIMARY KEY CHECK (id = 1), next_run_at INTEGER, settings_revision INTEGER NOT NULL,
      heartbeat_at INTEGER, last_run_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS worker_lease (
      id INTEGER PRIMARY KEY CHECK (id = 1), owner TEXT NOT NULL, expires_at INTEGER NOT NULL,
      heartbeat_at INTEGER NOT NULL, run_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS schedule_slots (
      scheduled_at INTEGER PRIMARY KEY, interval_minutes INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running','completed','missed')), run_id INTEGER,
      profile_version TEXT NOT NULL, profile_config TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS schedule_slot_targets (
      scheduled_at INTEGER NOT NULL REFERENCES schedule_slots(scheduled_at), provider_id INTEGER NOT NULL,
      model_id INTEGER NOT NULL, provider_model_id TEXT NOT NULL, model_revision TEXT,
      PRIMARY KEY (scheduled_at, provider_id, model_id)
    );
    CREATE INDEX IF NOT EXISTS idx_slot_target_history ON schedule_slot_targets(model_id, provider_id, scheduled_at);
    CREATE TABLE IF NOT EXISTS monitoring_target_periods (
      id INTEGER PRIMARY KEY, mapping_id INTEGER NOT NULL, provider_id INTEGER NOT NULL, model_id INTEGER NOT NULL,
      provider_model_id TEXT NOT NULL, model_revision TEXT, enabled_from INTEGER NOT NULL, enabled_until INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_target_open_period ON monitoring_target_periods(mapping_id) WHERE enabled_until IS NULL;
    CREATE INDEX IF NOT EXISTS idx_target_period_time ON monitoring_target_periods(enabled_from, enabled_until);
  `)
  const now = Date.now()
  database.prepare('INSERT OR IGNORE INTO monitoring_settings VALUES (1, ?, 1, ?)').run(JSON.stringify(DEFAULTS), now)
  database.prepare('INSERT OR IGNORE INTO worker_schedule VALUES (1, ?, 1, NULL, NULL)').run(now)
  const clock = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)"
  const synchronize = `
    UPDATE monitoring_target_periods SET enabled_until = ${clock}
    WHERE enabled_until IS NULL AND NOT EXISTS (
      SELECT 1 FROM provider_models pm JOIN providers p ON p.id=pm.provider_id JOIN monitored_models m ON m.id=pm.model_id
      WHERE pm.id=monitoring_target_periods.mapping_id AND pm.enabled=1 AND p.enabled=1 AND m.enabled=1
      AND pm.provider_model_id=monitoring_target_periods.provider_model_id
      AND pm.model_revision IS monitoring_target_periods.model_revision
    );
    INSERT INTO monitoring_target_periods(mapping_id,provider_id,model_id,provider_model_id,model_revision,enabled_from)
      SELECT pm.id,pm.provider_id,pm.model_id,pm.provider_model_id,pm.model_revision,${clock}
      FROM provider_models pm JOIN providers p ON p.id=pm.provider_id JOIN monitored_models m ON m.id=pm.model_id
      WHERE pm.enabled=1 AND p.enabled=1 AND m.enabled=1
      AND NOT EXISTS (SELECT 1 FROM monitoring_target_periods t WHERE t.mapping_id=pm.id AND t.enabled_until IS NULL);
  `
  database.exec(synchronize)
  for (const table of ['provider_models', 'providers', 'monitored_models']) {
    for (const operation of ['INSERT', 'UPDATE', 'DELETE']) {
      database.exec(`CREATE TRIGGER IF NOT EXISTS monitoring_${table}_${operation.toLowerCase()} AFTER ${operation} ON ${table} BEGIN ${synchronize} END;`)
    }
  }
}

export function validateMonitoringSettings(value: unknown): MonitoringSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Monitoring settings must be an object')
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !(key in DEFAULTS) && key !== 'dateFormat')) throw new Error('Unknown monitoring setting')
  if (typeof input.enabled !== 'boolean') throw new Error('enabled must be a boolean')
  if (typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 4000) throw new Error('prompt must contain 1–4000 characters')
  const ranges = { intervalMinutes: [1, 1440], maxTokens: [1, 4096], temperature: [0, 2], timeoutSeconds: [1, 300], concurrency: [1, 16], slowThresholdMs: [1, 300000] } as const
  for (const [name, [min, max]] of Object.entries(ranges)) {
    const number = input[name]
    if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max || (name !== 'temperature' && !Number.isInteger(number))) throw new Error(`${name} must be ${name === 'temperature' ? 'a number' : 'an integer'} from ${min} to ${max}`)
  }
  const dateFormat = typeof input.dateFormat === 'string' && ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'].includes(input.dateFormat) ? input.dateFormat as MonitoringSettings['dateFormat'] : 'DD/MM/YYYY'
  return { enabled: input.enabled, intervalMinutes: input.intervalMinutes as number, prompt: input.prompt, maxTokens: input.maxTokens as number, temperature: input.temperature as number, timeoutSeconds: input.timeoutSeconds as number, concurrency: input.concurrency as number, slowThresholdMs: input.slowThresholdMs as number, dateFormat }
}

function settingsRow() {
  return getDb().prepare('SELECT config, revision FROM monitoring_settings WHERE id=1').get() as { config: string; revision: number }
}
export function getMonitoringSettings(): MonitoringSettings { return JSON.parse(settingsRow().config) as MonitoringSettings }

interface ScheduleRow { next_run_at: number | null; settings_revision: number; heartbeat_at: number | null; last_run_at: number | null }
interface LeaseRow { owner: string; expires_at: number; run_id: number | null }
function scheduleRow(): ScheduleRow { return getDb().prepare('SELECT * FROM worker_schedule WHERE id=1').get() as ScheduleRow }
function leaseRow(): LeaseRow | undefined { return getDb().prepare('SELECT * FROM worker_lease WHERE id=1').get() as LeaseRow | undefined }

export function getMonitoringState(): MonitoringState {
  const schedule = scheduleRow()
  const lease = leaseRow()
  const now = Date.now()
  const lastRun = getDb().prepare('SELECT id, status, started_at, finished_at, duration_ms, error FROM probe_runs ORDER BY id DESC LIMIT 1').get() as { id: number; status: string; started_at: number; finished_at: number | null; duration_ms: number | null; error: string | null } | undefined
  const lastRunDurationMs = lastRun?.duration_ms ?? (lastRun?.finished_at && lastRun?.started_at ? lastRun.finished_at - lastRun.started_at : null)
  return {
    settings: getMonitoringSettings(),
    worker: {
      online: schedule.heartbeat_at !== null && schedule.heartbeat_at >= now - 30_000,
      heartbeatAt: schedule.heartbeat_at,
      nextRunAt: schedule.next_run_at,
      activeRunId: lease && lease.expires_at > now ? lease.run_id : null,
      lastRunAt: schedule.last_run_at,
      lastRunDurationMs,
      lastRunStatus: lastRun?.status ?? null
    }
  }
}

function insertSlot(at: number, settings: MonitoringSettings, status: 'running' | 'missed', runId: number | null) {
  const database = getDb()
  database.prepare('INSERT OR IGNORE INTO schedule_slots VALUES (?, ?, ?, ?, ?, ?)').run(at, settings.intervalMinutes, status, runId, profileVersion(settings), JSON.stringify(profileConfig(settings)))
  database.prepare(`INSERT OR IGNORE INTO schedule_slot_targets
    SELECT ?,provider_id,model_id,provider_model_id,model_revision FROM monitoring_target_periods
    WHERE enabled_from <= ? AND (enabled_until IS NULL OR enabled_until > ?)` ).run(at, at, at)
}

/** Records unavailable scheduled observations without executing a catch-up burst. */
function recordMissed(until: number, settings: MonitoringSettings) {
  const schedule = scheduleRow()
  if (!settings.enabled || schedule.next_run_at === null) return
  const step = settings.intervalMinutes * 60_000
  let at = schedule.next_run_at
  for (; at <= until; at += step) insertSlot(at, settings, 'missed', null)
  getDb().prepare('UPDATE worker_schedule SET next_run_at=? WHERE id=1').run(at)
}

function recoverExpired(now: number) {
  const lease = leaseRow()
  if (!lease || lease.expires_at > now) return
  if (lease.run_id !== null) {
    getDb().prepare("UPDATE probe_runs SET status='failed',finished_at=?,duration_ms=?-started_at,error='Worker lease expired' WHERE id=? AND status='running'").run(now, now, lease.run_id)
    getDb().prepare("UPDATE schedule_slots SET status='missed' WHERE run_id=? AND status='running'").run(lease.run_id)
    const latest = settingsRow()
    if (scheduleRow().settings_revision !== latest.revision) {
      const run = getDb().prepare('SELECT profile_config FROM probe_runs WHERE id=?').get(lease.run_id) as { profile_config: string | null } | undefined
      if (run?.profile_config) recordMissed(now, JSON.parse(run.profile_config) as MonitoringSettings)
      const settings = JSON.parse(latest.config) as MonitoringSettings
      getDb().prepare('UPDATE worker_schedule SET next_run_at=?,settings_revision=? WHERE id=1').run(settings.enabled ? now + settings.intervalMinutes * 60_000 : null, latest.revision)
    }
  }
  getDb().prepare('DELETE FROM worker_lease WHERE id=1 AND owner=?').run(lease.owner)
}

export function updateMonitoringSettings(value: unknown): MonitoringState {
  const settings = validateMonitoringSettings(value)
  getDb().transaction(() => {
    const now = Date.now()
    recoverExpired(now)
    const old = settingsRow()
    if (!leaseRow()) {
      recordMissed(now, JSON.parse(old.config) as MonitoringSettings)
      getDb().prepare('UPDATE worker_schedule SET next_run_at=?,settings_revision=? WHERE id=1').run(settings.enabled ? now + settings.intervalMinutes * 60_000 : null, old.revision + 1)
    }
    getDb().prepare('UPDATE monitoring_settings SET config=?,revision=revision+1,updated_at=? WHERE id=1').run(JSON.stringify(settings), now)
  }).immediate()
  return getMonitoringState()
}

export interface RunLease { owner: string; runId: number; startedAt: number; settings: MonitoringSettings; revision: number; mappings: ProviderModel[] }

export function acquireRun(trigger: string, scheduled: boolean): RunLease | null {
  return getDb().transaction(() => {
    const now = Date.now()
    recoverExpired(now)
    if (leaseRow()) return null
    const row = settingsRow()
    const settings = JSON.parse(row.config) as MonitoringSettings
    const schedule = scheduleRow()
    if (scheduled && (!settings.enabled || schedule.next_run_at === null || schedule.next_run_at > now)) return null
    const mappings = listProviderModels(undefined, true)
    let scheduledAt = now
    if (scheduled && schedule.next_run_at !== null) {
      const step = settings.intervalMinutes * 60_000
      scheduledAt = schedule.next_run_at + Math.floor((now - schedule.next_run_at) / step) * step
      recordMissed(scheduledAt - 1, settings)
    }
    const owner = randomUUID()
    const runId = createProbeRun({ scheduledAt, trigger, expectedCount: mappings.length, profileVersion: profileVersion(settings), profileConfig: profileConfig(settings), runnerVersion: RUNNER_VERSION })
    getDb().prepare('INSERT INTO worker_lease VALUES (1, ?, ?, ?, ?)').run(owner, now + MIN_LEASE_MS, now, runId)
    getDb().prepare('UPDATE worker_schedule SET heartbeat_at=?,last_run_at=? WHERE id=1').run(now, now)
    if (scheduled) {
      insertSlot(scheduledAt, settings, 'running', runId)
      getDb().prepare('UPDATE worker_schedule SET next_run_at=? WHERE id=1').run(scheduledAt + settings.intervalMinutes * 60_000)
    }
    return { owner, runId, startedAt: now, settings, revision: row.revision, mappings }
  }).immediate()
}

/** The child deadline must always precede lease expiry, including parent crashes. */
export function renewRun(lease: RunLease, horizonMs = MIN_LEASE_MS): number | null {
  return getDb().transaction(() => {
    const now = Date.now()
    const expires = now + Math.max(MIN_LEASE_MS, horizonMs)
    const updated = getDb().prepare('UPDATE worker_lease SET expires_at=?,heartbeat_at=? WHERE id=1 AND owner=? AND expires_at>?').run(expires, now, lease.owner, now)
    if (!updated.changes) return null
    getDb().prepare('UPDATE worker_schedule SET heartbeat_at=? WHERE id=1').run(now)
    return expires
  }).immediate()
}

export function completeRun(lease: RunLease, status: Exclude<RunStatus, 'running'>, results: ProbeInsert[], error: string | null): boolean {
  return getDb().transaction(() => {
    const now = Date.now()
    const current = leaseRow()
    if (!current || current.owner !== lease.owner || current.expires_at <= now) return false
    finishProbeRun({ runId: lease.runId, startedAt: lease.startedAt, status, results, error })
    getDb().prepare("UPDATE schedule_slots SET status='completed' WHERE run_id=? AND status='running'").run(lease.runId)
    recordMissed(now, lease.settings)
    const latest = settingsRow()
    const settings = JSON.parse(latest.config) as MonitoringSettings
    getDb().prepare('UPDATE worker_schedule SET next_run_at=?,settings_revision=?,heartbeat_at=? WHERE id=1').run(settings.enabled ? now + settings.intervalMinutes * 60_000 : null, latest.revision, now)
    getDb().prepare('DELETE FROM worker_lease WHERE id=1 AND owner=?').run(lease.owner)
    return true
  }).immediate()
}

export function heartbeatWorker() {
  getDb().prepare('UPDATE worker_schedule SET heartbeat_at=? WHERE id=1').run(Date.now())
}
