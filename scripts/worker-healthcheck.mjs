import Database from 'better-sqlite3'

let db
try {
  db = new Database(process.env.PROBE_DB || '/data/dashboard.db', {
    readonly: true,
    fileMustExist: true,
    timeout: 3000,
  })
  const row = db.prepare('SELECT heartbeat_at FROM worker_schedule WHERE id = 1').get()
  const age = Date.now() - row?.heartbeat_at
  if (!Number.isFinite(age) || row?.heartbeat_at == null || age < -5000 || age > 30000) {
    process.exitCode = 1
  }
} catch {
  process.exitCode = 1
} finally {
  db?.close()
}
