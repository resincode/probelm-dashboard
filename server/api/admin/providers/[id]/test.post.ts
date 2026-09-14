import { fetchProviderCatalog } from '../../../../utils/provider-store'

export default defineEventHandler(async event => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid provider ID' })
  try {
    const models = await fetchProviderCatalog(id)
    return { ok: true, modelCount: models.length }
  } catch {
    return { ok: false, modelCount: 0 }
  }
})
