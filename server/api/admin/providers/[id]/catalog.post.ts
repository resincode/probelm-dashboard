import { syncProviderCatalog } from '../../../../utils/provider-store'

export default defineEventHandler(event => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid provider ID' })
  return syncProviderCatalog(id)
})
