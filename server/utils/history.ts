import { getDb } from './db'
import { getMonitoringState } from './scheduler'
import type { CanonicalModel, HistoryBucket, HistoryPoint, ModelHistory, MonitorStatus, PublicMonitor, PublicOverview, PublicProvider } from '../../shared/types'

type ResultRow = {
  id: number; run_id: number; provider_id: number; model_id: number; provider_model_id: string;
  ts: number; ping_ok: number | null; http_code: number | null; ttft_ms: number | null;
  total_ms: number | null; tokens: number | null; rate_per_sec: number | null;
  error: string | null; profile_version: string; profile_config: string | null; model_revision: string | null
}
type MissedRow = { scheduled_at: number; provider_id: number; provider_model_id: string; model_revision: string | null; profile_version: string; profile_config: string | null }
type Profile = { intervalMinutes: number | null; slowThresholdMs: number }
const MAX_POINTS = 100_000

function profileSettings(config: string | null): Profile {
  if (config) {
    try {
      const parsed: unknown = JSON.parse(config)
      if (parsed && typeof parsed === 'object') {
        const interval = Reflect.get(parsed, 'intervalMinutes')
        const slow = Reflect.get(parsed, 'slowThresholdMs')
        return { intervalMinutes: typeof interval === 'number' && interval > 0 ? interval : null, slowThresholdMs: typeof slow === 'number' && slow > 0 ? slow : 3000 }
      }
    } catch { /* Legacy results have no reproducible profile snapshot. */ }
  }
  return { intervalMinutes: null, slowThresholdMs: 3000 }
}

function profileId(version: string, revision: string | null): string {
  return Buffer.from(JSON.stringify([version, revision])).toString('base64url')
}

function statusOf(row: Pick<ResultRow, 'ping_ok' | 'http_code' | 'ttft_ms' | 'total_ms' | 'error'>, threshold: number): MonitorStatus {
  if (row.error?.startsWith('Configuration:') || row.http_code === 401 || row.http_code === 403) return 'configuration-error'
  if (row.ping_ok !== 1 || row.ttft_ms == null || row.total_ms == null || row.error) return 'down'
  return row.ttft_ms >= threshold ? 'slow' : 'up'
}

function safeError(row: ResultRow, status: MonitorStatus): string | null {
  if (status === 'configuration-error') {
    if (row.http_code === 401 || row.http_code === 403) return `HTTP ${row.http_code}: Unauthorized / Invalid provider credentials.`
    return 'Provider configuration or endpoint requires administrator attention.'
  }
  if (status !== 'down') return null
  if (row.http_code === 429) return 'HTTP 429: Gateway rate limited this probe.'
  if (row.http_code && row.http_code >= 400) return `HTTP ${row.http_code}: Gateway returned error response.`
  if (row.error) {
    const err = row.error.trim().toLowerCase()
    if (err.includes('stream') || err.includes('incomplete')) return 'Stream incomplete: model response stream closed before completion.'
    if (err.includes('availability') || err.includes('ping')) return 'Availability ping check failed before generation.'
    if (err.includes('timeout') || err.includes('timed out')) return 'Probe request timed out.'
    if (err.includes('unreachable') || err.includes('refused') || err.includes('connection')) return 'Gateway connection unreachable or refused.'
    return 'Probe failed or returned incomplete measurements.'
  }
  return 'Probe failed or returned no response measurements.'
}

function currentStatus(row: ResultRow | undefined, interval: number, timeout: number, threshold: number, now: number): MonitorStatus {
  if (!row) return 'no-data'
  if (now - row.ts > interval * 60_000 * 1.5 + timeout * 1000) return 'stale'
  return statusOf(row, threshold)
}

export function publicOverview(): PublicOverview {
  const database = getDb()
  const state = getMonitoringState()
  const now = Date.now()
  const providers = database.prepare('SELECT id,name,slug,icon_url AS iconUrl,enabled FROM providers ORDER BY name').all() as Array<{ id: number; name: string; slug: string; iconUrl: string | null; enabled: number }>
  const models = database.prepare('SELECT id,canonical_name AS canonicalName,display_name AS displayName,icon_key AS iconKey FROM monitored_models WHERE EXISTS (SELECT 1 FROM provider_models pm WHERE pm.model_id=monitored_models.id) ORDER BY display_name').all() as CanonicalModel[]
  const mappings = database.prepare(`SELECT pm.id,pm.model_id,pm.provider_id,pm.provider_model_id,pm.model_revision,pm.enabled,p.enabled AS provider_enabled,
    p.name AS provider_name,p.slug AS provider_slug,mm.canonical_name,mm.display_name
    FROM provider_models pm JOIN providers p ON p.id=pm.provider_id JOIN monitored_models mm ON mm.id=pm.model_id
    WHERE pm.id=(SELECT id FROM provider_models candidate WHERE candidate.provider_id=pm.provider_id AND candidate.model_id=pm.model_id ORDER BY candidate.enabled DESC,candidate.id DESC LIMIT 1)
    ORDER BY mm.display_name,p.name`).all() as Array<{ id: number; model_id: number; provider_id: number; provider_model_id: string; model_revision: string | null; enabled: number; provider_enabled: number; provider_name: string; provider_slug: string; canonical_name: string; display_name: string }>
  const latest = database.prepare(`SELECT pr.*,r.profile_version,r.profile_config
    FROM provider_models pm JOIN probe_results pr ON pr.id=(
      SELECT candidate.id FROM probe_results candidate
      WHERE candidate.provider_id=pm.provider_id AND candidate.model_id=pm.model_id
        AND candidate.provider_model_id=pm.provider_model_id AND candidate.model_revision IS pm.model_revision
      ORDER BY candidate.id DESC LIMIT 1
    ) JOIN probe_runs r ON r.id=pr.run_id
    WHERE pm.id=(SELECT id FROM provider_models candidate WHERE candidate.provider_id=pm.provider_id AND candidate.model_id=pm.model_id ORDER BY candidate.enabled DESC,candidate.id DESC LIMIT 1)`).all() as ResultRow[]
  const byIdentity = new Map(latest.map(row => [JSON.stringify([row.provider_id,row.model_id,row.provider_model_id,row.model_revision]), row]))
  const monitors: PublicMonitor[] = mappings.map(mapping => {
    const row = byIdentity.get(JSON.stringify([mapping.provider_id,mapping.model_id,mapping.provider_model_id,mapping.model_revision]))
    return {
      id: `${mapping.provider_id}:${mapping.model_id}`, modelId: mapping.model_id, canonicalName: mapping.canonical_name,
      displayName: mapping.display_name, providerId: mapping.provider_id, providerName: mapping.provider_name,
      providerSlug: mapping.provider_slug, providerModelId: mapping.provider_model_id, modelRevision: mapping.model_revision,
      enabled: mapping.enabled === 1 && mapping.provider_enabled === 1,
      status: currentStatus(row,state.settings.intervalMinutes,state.settings.timeoutSeconds,state.settings.slowThresholdMs,now),
      lastProbeAt: row?.ts ?? null, ttftMs: row?.ttft_ms ?? null, totalMs: row?.total_ms ?? null, ratePerSec: row?.rate_per_sec ?? null,
    }
  })
  return { generatedAt: now, providers: providers.map(provider => ({ ...provider, enabled: provider.enabled === 1 })), models, monitors, worker: state.worker, intervalMinutes: state.settings.intervalMinutes, slowThresholdMs: state.settings.slowThresholdMs, dateFormat: state.settings.dateFormat || 'DD/MM/YYYY' }
}

function average(values: number[]): number | null { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null }
function percentile(values: number[], fraction: number): number | null { return values.length ? values[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? null : null }

export function modelHistory(modelId: number, from: number, to: number, requestedProfile?: string): ModelHistory | null {
  const database = getDb()
  const model = database.prepare('SELECT id,canonical_name AS canonicalName,display_name AS displayName,icon_key AS iconKey FROM monitored_models WHERE id=?').get(modelId) as CanonicalModel | undefined
  if (!model) return null
  const raw = database.prepare(`SELECT pr.*,r.profile_version,r.profile_config FROM probe_results pr JOIN probe_runs r ON r.id=pr.run_id
    WHERE pr.model_id=? AND pr.ts>=? AND pr.ts<? ORDER BY pr.ts DESC,pr.id DESC LIMIT ?`).all(modelId,from,to,MAX_POINTS + 1) as ResultRow[]
  const truncated = raw.length > MAX_POINTS
  const rows = raw.slice(0,MAX_POINTS).reverse()
  const missed = database.prepare(`SELECT s.scheduled_at,t.provider_id,t.provider_model_id,t.model_revision,s.profile_version,s.profile_config
    FROM schedule_slots s JOIN schedule_slot_targets t ON t.scheduled_at=s.scheduled_at
    WHERE t.model_id=? AND s.status='missed' AND s.scheduled_at>=? AND s.scheduled_at<? ORDER BY s.scheduled_at`).all(modelId,from,to) as MissedRow[]
  const profileMap = new Map<string, { id: string; label: string; ts: number }>()
  for (const row of [...rows, ...missed]) {
    const id = profileId(row.profile_version,row.model_revision)
    const ts = 'ts' in row ? row.ts : row.scheduled_at
    const existing = profileMap.get(id)
    if (!existing || existing.ts < ts) profileMap.set(id, { id, label: `${row.profile_version} · ${row.model_revision || 'revision unspecified'}`, ts })
  }
  const profiles = [...profileMap.values()].sort((a,b) => b.ts-a.ts).map(({ id,label }) => ({ id,label }))
  const selectedProfile = requestedProfile && profileMap.has(requestedProfile) ? requestedProfile : profiles[0]?.id ?? null
  const filtered = rows.filter(row => profileId(row.profile_version,row.model_revision) === selectedProfile)
  const filteredMissed = missed.filter(row => profileId(row.profile_version,row.model_revision) === selectedProfile)
  const overview = publicOverview()
  const providers = new Map(overview.providers.map(provider => [provider.id,provider]))
  const currentMappings = overview.monitors.filter(monitor => monitor.modelId===modelId)
  const providerIds = new Set([...currentMappings.map(mapping=>mapping.providerId), ...filtered.map(row=>row.provider_id), ...filteredMissed.map(row=>row.provider_id)])
  const bucketMs = Math.max(60_000, Math.ceil((to-from)/96/60_000)*60_000)
  const count = Math.ceil((to-from)/bucketMs)
  const byProvider = new Map<number,ResultRow[]>()
  for (const row of filtered) { const values=byProvider.get(row.provider_id) || []; values.push(row); byProvider.set(row.provider_id,values) }
  const series = [...providerIds].map(providerId => {
    const provider: PublicProvider = providers.get(providerId)!
    const providerRows = byProvider.get(providerId) || []
    const mapping = currentMappings.find(item=>item.providerId===providerId)
    const providerMissed = filteredMissed.filter(row=>row.provider_id===providerId)
    const points: HistoryPoint[] = providerRows.map(row => {
      const config = profileSettings(row.profile_config)
      const status = statusOf(row,config.slowThresholdMs)
      return { ts:row.ts, runId:row.run_id, status, ttftMs:row.ttft_ms, totalMs:row.total_ms, tokens:row.tokens, ratePerSec:row.rate_per_sec, httpCode:row.http_code,
        error:safeError(row,status), profileVersion:row.profile_version, modelRevision:row.model_revision, intervalMinutes:config.intervalMinutes }
    })
    const buckets: HistoryBucket[] = Array.from({ length: count },(_,index)=>({start:from+index*bucketMs,end:Math.min(to,from+(index+1)*bucketMs),status:'no-data',samples:0,failures:0,missing:0,avgTtftMs:null}))
    const bucketTtft = new Map<number,{ sum:number; count:number }>()
    for (const point of points) {
      const index = Math.floor((point.ts-from)/bucketMs)
      const bucket = buckets[index]
      if (!bucket) continue
      bucket.samples++
      const successful = point.status==='up' || point.status==='slow'
      if (!successful) { bucket.failures++; bucket.status=point.status }
      else if (!bucket.failures) bucket.status=point.status==='slow' || bucket.status==='slow' ? 'slow' : 'up'
      if (successful && point.ttftMs!=null) {
        const previous=bucketTtft.get(index) || {sum:0,count:0}; previous.sum+=point.ttftMs; previous.count++; bucketTtft.set(index,previous)
      }
    }
    for (const slot of providerMissed) { const bucket=buckets[Math.floor((slot.scheduled_at-from)/bucketMs)]; if (bucket) { bucket.missing++; if (!bucket.failures) bucket.status='no-data' } }
    for (const [index,value] of bucketTtft) { const bucket=buckets[index]; if (bucket) bucket.avgTtftMs=value.sum/value.count }
    const successes = points.filter(point=>point.status==='up' || point.status==='slow')
    const ttfts=successes.flatMap(point=>point.ttftMs==null?[]:[point.ttftMs]).sort((a,b)=>a-b)
    const last=providerRows[providerRows.length-1]
    return { provider, providerModelId:last?.provider_model_id ?? mapping?.providerModelId ?? providerMissed[0]?.provider_model_id ?? '',
      modelRevision:last?.model_revision ?? providerMissed[0]?.model_revision ?? mapping?.modelRevision ?? null,
      status:last ? statusOf(last,profileSettings(last.profile_config).slowThresholdMs) : 'no-data' as MonitorStatus, points,buckets,
      summary:{samples:points.length,successes:successes.length,failures:points.length-successes.length,missing:providerMissed.length,
        successRate:points.length?successes.length/points.length:null,p50TtftMs:percentile(ttfts,.5),p95TtftMs:percentile(ttfts,.95),
        avgTotalMs:average(successes.flatMap(point=>point.totalMs==null?[]:[point.totalMs])),avgRatePerSec:average(successes.flatMap(point=>point.ratePerSec==null?[]:[point.ratePerSec]))} }
  }).sort((a,b)=>a.provider.name.localeCompare(b.provider.name))
  return { model,from,to,bucketMs,profiles,selectedProfile,series,truncated,
    measurements:{ttft:'Time to first streamed content or reasoning, as reported by probelm.',throughput:'End-to-end output tokens / total request seconds; not isolated decoding speed. Short replies are not a reliable throughput benchmark.',tokens:'Reported by probelm; may be estimated when gateway usage is absent. Legacy measurements have no recoverable profile snapshot.'} }
}
