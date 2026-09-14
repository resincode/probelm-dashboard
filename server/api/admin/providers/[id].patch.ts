import { saveProvider } from '../../../utils/provider-store'

export default defineEventHandler(async event => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isSafeInteger(id) || id < 1) throw createError({ statusCode: 400, statusMessage: 'Invalid provider ID' })
  return saveProvider(await readBody(event), id)
})
