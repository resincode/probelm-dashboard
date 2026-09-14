import { updateMonitoringSettings, validateMonitoringSettings } from '../../../utils/scheduler'

export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event)
  let settings
  try {
    settings = validateMonitoringSettings(body)
  } catch (error) {
    throw createError({ statusCode: 400, statusMessage: error instanceof Error ? error.message : 'Invalid monitoring settings' })
  }
  return updateMonitoringSettings(settings)
})
