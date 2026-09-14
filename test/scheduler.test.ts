import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const temp=mkdtempSync(join(tmpdir(),'probelm-scheduler-test-'))
process.env.PROBE_DB=join(temp,'scheduler.db')
// These tests intentionally load the persistence singleton after choosing an isolated database.
const { getDb }=await import('../server/utils/db')
const { acquireRun, completeRun, getMonitoringState, updateMonitoringSettings }=await import('../server/utils/scheduler')
const database=getDb()
after(()=>{database.close();rmSync(temp,{recursive:true,force:true})})

test('run claims exclude overlapping workers and fence an expired owner',()=>{
  const first=acquireRun('test',false)!
  assert.ok(first)
  assert.equal(acquireRun('second-process',false),null)
  database.prepare('UPDATE worker_lease SET expires_at=? WHERE id=1').run(Date.now()-1)
  const replacement=acquireRun('replacement',false)!
  assert.ok(replacement)
  assert.notEqual(replacement.owner,first.owner)
  assert.equal(completeRun(first,'completed',[],null),false)
  assert.equal(getMonitoringState().worker.activeRunId,replacement.runId)
  assert.equal(completeRun(replacement,'completed',[],null),true)
  assert.equal(getMonitoringState().worker.activeRunId,null)
  const interrupted=database.prepare('SELECT status,error FROM probe_runs WHERE id=?').get(first.runId) as {status:string;error:string}
  assert.equal(interrupted.status,'failed')
  assert.equal(interrupted.error,'Worker lease expired')
})

test('editing interval leaves active profile unchanged and applies to the next execution',()=>{
  const before=getMonitoringState().settings
  const running=acquireRun('test',false)!
  updateMonitoringSettings({...before,intervalMinutes:15,prompt:'New profile'})
  assert.equal(running.settings.intervalMinutes,before.intervalMinutes)
  assert.equal(running.settings.prompt,before.prompt)
  const completedAt=Date.now()
  assert.equal(completeRun(running,'completed',[],null),true)
  const state=getMonitoringState()
  assert.equal(state.settings.intervalMinutes,15)
  assert.ok(state.worker.nextRunAt! >= completedAt+15*60_000)
  assert.ok(state.worker.nextRunAt! <= Date.now()+15*60_000)
})

test('disabled monitoring never claims a scheduled probe and rejects invalid intervals',()=>{
  updateMonitoringSettings({...getMonitoringState().settings,enabled:false})
  assert.equal(acquireRun('scheduled',true),null)
  assert.equal(getMonitoringState().worker.nextRunAt,null)
  assert.throws(()=>updateMonitoringSettings({...getMonitoringState().settings,intervalMinutes:0}),/intervalMinutes/)
  assert.equal(getMonitoringState().settings.enabled,false)
})
