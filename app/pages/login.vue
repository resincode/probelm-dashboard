<script setup lang="ts">
const { login, load } = useAdminSession()
const { t } = useI18n()
const username = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')
onMounted(async () => {
  try { const session = await load(); if (session.user) await navigateTo(session.user.mustChangePassword ? '/admin/settings' : '/admin/providers') } catch { error.value = t('login.sessionUnavailable') }
})
async function submit() {
  busy.value = true; error.value = ''
  try { await login(username.value, password.value); password.value = ''; await navigateTo('/admin/settings') }
  catch (cause) { error.value = cause instanceof Error ? cause.message : t('login.failed') }
  finally { busy.value = false }
}
</script>
<template>
  <main class="login-shell stack">
    <div class="row spread">
      <NuxtLink to="/">{{ t('login.publicDashboard') }}</NuxtLink>
      <div class="row" style="gap:8px">
        <ThemeToggle />
        <LanguageSwitcher />
      </div>
    </div>
    <h1>{{ t('login.title') }}</h1>
    <p class="muted">{{ t('login.subtitle') }}</p>
    <form class="panel stack" @submit.prevent="submit">
      <label>{{ t('login.username') }}<input v-model="username" autocomplete="username" required autofocus /></label>
      <label>{{ t('login.password') }}<input v-model="password" type="password" autocomplete="current-password" required /></label>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <button class="primary" :disabled="busy">{{ busy ? t('login.submitting') : t('login.submit') }}</button>
    </form>
  </main>
</template>
