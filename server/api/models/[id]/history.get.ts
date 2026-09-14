import { modelHistory } from '../../../utils/history'

export default defineEventHandler((event) => {
  const modelId = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(modelId) || modelId < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid model ID' })
  const query = getQuery(event)
  const to = query.to === undefined ? Date.now() : Number(query.to)
  const from = query.from === undefined ? to - 24 * 3600_000 : Number(query.from)
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || to - from > 366 * 86400_000) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a valid time range of at most 366 days' })
  }
  if (query.profile !== undefined && (typeof query.profile !== 'string' || query.profile.length > 512)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid profile' })
  }
  const history = modelHistory(modelId, from, to, query.profile)
  if (!history) throw createError({ statusCode: 404, statusMessage: 'Model not found' })
  return history
})
