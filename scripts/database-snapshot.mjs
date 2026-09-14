import Database from 'better-sqlite3'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, link, mkdtemp, readdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'

// Invoked by deploy/database.sh inside the same Linux image as the application.
// Backup uses SQLite's online backup API, so committed WAL data is included.
const [operation, databasePath = process.env.PROBE_DB || '/data/dashboard.db'] = process.argv.slice(2)
let temporaryDirectory
let db
try {
  if (operation === 'backup') {
    temporaryDirectory = await mkdtemp(join(dirname(databasePath), '.backup-'))
    const snapshot = join(temporaryDirectory, 'snapshot.db')
    db = new Database(databasePath, { readonly: true, fileMustExist: true, timeout: 10000 })
    await db.backup(snapshot)
    db.close()
    db = undefined
    await pipeline(createReadStream(snapshot), process.stdout)
  } else if (operation === 'restore') {
    const directory = dirname(databasePath)
    if ((await readdir(directory)).length !== 0) {
      throw new Error('Destination volume is not empty; restore into a new volume instead')
    }
    temporaryDirectory = await mkdtemp(join(directory, '.restore-'))
    const snapshot = join(temporaryDirectory, 'snapshot.db')
    await pipeline(process.stdin, createWriteStream(snapshot, { flags: 'wx', mode: 0o600 }))
    db = new Database(snapshot, { readonly: true, fileMustExist: true, timeout: 10000 })
    const checks = db.pragma('quick_check')
    if (checks.length !== 1 || checks[0].quick_check !== 'ok') {
      throw new Error('Snapshot failed SQLite integrity verification')
    }
    db.close()
    db = undefined
    const entries = await readdir(directory)
    if (entries.length !== 1 || join(directory, entries[0]) !== temporaryDirectory) {
      throw new Error('Destination changed during restore; refusing to publish snapshot')
    }
    await chmod(snapshot, 0o600)
    // Atomic and exclusive: unlike rename(), link() never replaces an existing DB.
    await link(snapshot, databasePath)
    console.error('Restored snapshot into empty volume; original backup is unchanged.')
  } else {
    throw new Error('Expected backup or restore operation')
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Snapshot operation failed')
  process.exitCode = 1
} finally {
  db?.close()
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
}
