import { getAuthState } from '../../utils/auth'

export default defineEventHandler(event => getAuthState(event))
