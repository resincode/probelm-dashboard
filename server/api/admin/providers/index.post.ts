import { saveProvider } from '../../../utils/provider-store'

export default defineEventHandler(async event => saveProvider(await readBody(event)))
