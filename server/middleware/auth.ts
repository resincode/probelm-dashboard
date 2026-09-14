import { createError, defineEventHandler, getRequestURL, sendRedirect, setHeader } from 'h3'
import { getAuthState, requireAdmin, requireCsrf, requireSameOrigin } from '../utils/auth'

export default defineEventHandler(event => {
  let path: string
  try { path = decodeURIComponent(getRequestURL(event).pathname).toLowerCase().replace(/\/+$/, '') }
  catch { throw createError({ statusCode: 400, statusMessage: 'Invalid request path' }) }
  if (path === '/admin' || path.startsWith('/admin/')) {
    setHeader(event, 'Cache-Control', 'no-store')
    const auth = getAuthState(event)
    if (!auth.user) return sendRedirect(event, '/login', 302)
    if (auth.user.mustChangePassword && path !== '/admin/settings') return sendRedirect(event, '/admin/settings', 302)
  }
  if (!path.startsWith('/api/')) return
  setHeader(event, 'Cache-Control', 'no-store')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  const readOnly = event.method === 'GET' || event.method === 'HEAD'
  const publicRead = path === '/api/overview' || path === '/api/health' || /^\/api\/models\/\d+\/history$/.test(path)
  if (publicRead && readOnly) return
  if (path === '/api/auth/login' && event.method === 'POST') { requireSameOrigin(event); return }
  if (path === '/api/auth/session' && readOnly) return
  if (path === '/api/auth/password' || path === '/api/auth/logout') {
    requireAdmin(event, true)
    if (!readOnly) requireCsrf(event)
    return
  }
  requireAdmin(event)
  if (!readOnly) requireCsrf(event)
  if (!path.startsWith('/api/admin/')) throw createError({ statusCode: 404, statusMessage: 'API route not found' })
})
