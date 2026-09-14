export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return
  const { load } = useAdminSession()
  try {
    const session = await load()
    if (!session.user) return navigateTo('/login')
    if (session.user.mustChangePassword && to.path !== '/admin/settings') return navigateTo('/admin/settings')
  } catch {
    return navigateTo('/login')
  }
})
