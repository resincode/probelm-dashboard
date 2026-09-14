import { runProbe } from '../server/utils/probe'

// A normal shutdown waits for this bounded, fenced run rather than abandoning it.
const waitForRun = () => {}
process.on('SIGTERM', waitForRun)
process.on('SIGINT', waitForRun)
try {
  const result = await runProbe({ trigger: 'external' })
  console.log(JSON.stringify(result))
  process.exitCode = result.status === 'failed' ? 1 : 0
} catch {
  console.error('Worker execution failed')
  process.exitCode = 1
} finally {
  process.removeListener('SIGTERM', waitForRun)
  process.removeListener('SIGINT', waitForRun)
}
