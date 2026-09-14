import type { AuthState } from '../../shared/types'

export function useAdminSession() {
  const auth = useState<AuthState>('admin-session', () => ({ user: null, csrfToken: null }))
  async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (method !== 'GET' && auth.value.csrfToken) headers['X-CSRF-Token'] = auth.value.csrfToken
    const response = await fetch(url, { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) })
    if (!response.ok) {
      if (response.status === 401 && url !== '/api/auth/login') {
        auth.value = { user: null, csrfToken: null }
        await navigateTo('/login')
      }
      const detail = await response.json().catch(() => null)
      throw new Error(detail?.statusMessage || detail?.message || `Request failed (${response.status})`)
    }
    return await response.json() as T
  }
  async function load() { auth.value = await request<AuthState>('/api/auth/session'); return auth.value }
  async function login(username: string, password: string) { auth.value = await request<AuthState>('/api/auth/login', 'POST', { username, password }) }
  async function changePassword(currentPassword: string, newPassword: string) { auth.value = await request<AuthState>('/api/auth/password', 'POST', { currentPassword, newPassword }) }
  async function logout() { auth.value = await request<AuthState>('/api/auth/logout', 'POST'); await navigateTo('/login') }
  return { auth, request, load, login, changePassword, logout }
}
