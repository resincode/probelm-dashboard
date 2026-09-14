import { logout } from '../../utils/auth'

export default defineEventHandler(event => logout(event))
