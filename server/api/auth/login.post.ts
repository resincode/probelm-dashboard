import { login } from '../../utils/auth'

export default defineEventHandler(async event => login(event, await readBody(event)))
