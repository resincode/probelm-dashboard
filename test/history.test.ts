import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const temp = mkdtempSync(join(tmpdir(), 'probelm-history-test-'))
process.env.PROBE_DB = join(temp, 'history.db')
// Import only after selecting an isolated database: this exercises first-load migrations.
const { getDb, createProbeRun, finishProbeRun } = await import('../server/utils/db')
const { modelHistory, publicOverview } = await import('../server/utils/history')
const { normalizeApiBase } = await import('../server/utils/network')
const database = getDb()
after(() => { database.close(); rmSync(temp, { recursive: true, force: true }) })
let fixtureCount = 0
interface Fixture { provider: number; model: number; now: number }
function fixture(): Fixture {
  const name = `history-${++fixtureCount}`
  const now = Date.now()
  const provider = Number(database.prepare('INSERT INTO providers(name,slug,base_url,api_key_env,created_at,updated_at) VALUES(?,?,?,?,?,?)').run(name,name,'https://private-address.invalid/v1','SECRET_ENV',now,now).lastInsertRowid)
  const model = Number(database.prepare('INSERT INTO monitored_models(canonical_name,display_name) VALUES(?,?)').run(name,name).lastInsertRowid)
  database.prepare('INSERT INTO provider_models(provider_id,model_id,provider_model_id,model_revision) VALUES(?,?,?,?)').run(provider,model,'gateway/model','r1')
  return { provider,model,now }
}
function result(target: Fixture, ts: number, version = 'profile-a', revision: string | null = 'r1', error: string | null = null, ttftMs: number | null = 100) {
  const runId = createProbeRun({scheduledAt:ts,trigger:'test',expectedCount:1,profileVersion:version,runnerVersion:'test',profileConfig:{intervalMinutes:60,slowThresholdMs:3000}})
  finishProbeRun({runId,startedAt:ts,status:error?'failed':'completed',results:[{providerId:target.provider,modelId:target.model,providerModelId:'gateway/model',ts,modelRevision:revision,pingOk:true,httpCode:200,ttftMs,totalMs:ttftMs==null?null:500,tokens:10,ratePerSec:20,contextWindow:null,maxOutput:null,caps:null,error}]})
  return runId
}

test('history statistics never combine different probe profiles or model revisions', () => {
  const target = fixture()
  result(target,target.now-3000,'profile-a','r1',null,100)
  result(target,target.now-2000,'profile-b','r1',null,500)
  result(target,target.now-1000,'profile-b','r2',null,900)
  const history = modelHistory(target.model,target.now-5000,target.now)!
  assert.equal(history.profiles.length,3)
  assert.equal(history.series[0]?.summary.samples,1)
  assert.equal(history.series[0]?.summary.p50TtftMs,900)
  const older = history.profiles.find(profile=>profile.label.startsWith('profile-a'))!
  const selected = modelHistory(target.model,target.now-5000,target.now,older.id)!
  assert.equal(selected.series[0]?.summary.p50TtftMs,100)
  assert.equal(selected.series[0]?.modelRevision,'r1')
})

test('history buckets use half-open intervals and preserve failures within an aggregate', () => {
  const target = fixture()
  const from = target.now-96*60_000
  result(target,from+30_000,'profile-a','r1','secret-value https://private-address.invalid/error')
  result(target,from+59_999)
  result(target,from+60_000)
  const history = modelHistory(target.model,from,target.now)!
  const series = history.series[0]!
  assert.equal(series.buckets[0]?.samples,2)
  assert.equal(series.buckets[0]?.failures,1)
  assert.equal(series.buckets[0]?.status,'down')
  assert.equal(series.buckets[1]?.samples,1)
  assert.equal(series.summary.successRate,2/3)
  assert.ok(!JSON.stringify(history).includes('secret-value'))
  assert.ok(!JSON.stringify(history).includes('private-address.invalid'))
})

test('missed schedules remain separate from sampled request success', () => {
  const target = fixture()
  const ts=target.now-60_000
  result(target,ts)
  database.prepare('INSERT INTO schedule_slots(scheduled_at,interval_minutes,status,run_id,profile_version,profile_config) VALUES(?,?,?,NULL,?,?)').run(ts-60_000,60,'missed','profile-a',JSON.stringify({intervalMinutes:60,slowThresholdMs:3000}))
  database.prepare('INSERT INTO schedule_slot_targets(scheduled_at,provider_id,model_id,provider_model_id,model_revision) VALUES(?,?,?,?,?)').run(ts-60_000,target.provider,target.model,'gateway/model','r1')
  const history=modelHistory(target.model,target.now-180_000,target.now)!
  assert.equal(history.series[0]?.summary.samples,1)
  assert.equal(history.series[0]?.summary.missing,1)
  assert.equal(history.series[0]?.summary.successRate,1)
  assert.equal(history.series[0]?.buckets.reduce((sum,bucket)=>sum+bucket.missing,0),1)
})

test('stale and incomplete probes cannot appear healthy, and public overview hides endpoint configuration', () => {
  const stale=fixture()
  result(stale,stale.now-5*3600_000)
  const incomplete=fixture()
  result(incomplete,incomplete.now-1000,'profile-a','r1',null,null)
  const overview=publicOverview()
  assert.equal(overview.monitors.find(monitor=>monitor.modelId===stale.model)?.status,'stale')
  assert.equal(overview.monitors.find(monitor=>monitor.modelId===incomplete.model)?.status,'down')
  const serialized=JSON.stringify(overview)
  assert.ok(!serialized.includes('private-address.invalid'))
  assert.ok(!serialized.includes('SECRET_ENV'))
})

test('normalizeApiBase preserves user endpoints exactly without forcing /v1 suffix', () => {
  assert.equal(normalizeApiBase('https://openrouter.ai/api/v1'), 'https://openrouter.ai/api/v1')
  assert.equal(normalizeApiBase('https://openrouter.ai/api/v1/'), 'https://openrouter.ai/api/v1')
  assert.equal(normalizeApiBase('http://localhost:20128'), 'http://localhost:20128')
  assert.equal(normalizeApiBase('http://localhost:20128/'), 'http://localhost:20128')
  assert.equal(normalizeApiBase('https://proxy.internal:8080/custom/api'), 'https://proxy.internal:8080/custom/api')
})
