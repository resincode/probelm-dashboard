import { changePassword } from '../../utils/auth'

export default defineEventHandler(async event => changePassword(event, await readBody(event)))
