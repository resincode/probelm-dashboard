import { getMonitoringState } from '../utils/scheduler'

export default defineEventHandler(() => ({
  ok: true,
  at: Date.now(),
  workerOnline: getMonitoringState().worker.online,
}))
