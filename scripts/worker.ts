import { setTimeout as delay } from 'node:timers/promises'
import { runProbe } from '../server/utils/probe'
import { heartbeatWorker } from '../server/utils/scheduler'

let stopping = false
let wake: AbortController | null = null
const stop = () => { stopping = true; wake?.abort() }
process.on('SIGTERM', stop)
process.on('SIGINT', stop)

try {
  heartbeatWorker()
  console.log('ProbeLM worker ready')
  while (!stopping) {
    heartbeatWorker()
    const result = await runProbe({ trigger: 'scheduled', scheduled: true })
    if (result.status !== 'skipped') console.log(JSON.stringify(result))
    if (!stopping) {
      wake = new AbortController()
      await delay(2000, undefined, { signal: wake.signal }).catch((error: unknown) => {
        if (!(error instanceof Error) || error.name !== 'AbortError') throw error
      })
      wake = null
    }
  }
} catch {
  console.error('Worker service failed')
  process.exitCode = 1
} finally {
  process.removeListener('SIGTERM', stop)
  process.removeListener('SIGINT', stop)
}
