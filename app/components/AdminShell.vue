<script setup lang="ts">
import { LogOut, Activity } from 'lucide-vue-next'
const { auth, logout } = useAdminSession()
const { t } = useI18n()
const error = ref('')
async function signOut() {
  try { await logout() } catch (cause) { error.value = cause instanceof Error ? cause.message : t('admin.signOutError') }
}
</script>
<template>
  <div class="admin-shell">
    <nav class="admin-nav" :aria-label="t('admin.shellAria')">
      <NuxtLink class="brand row" to="/"><Activity :size="20" /> Probelm</NuxtLink>
      <NuxtLink to="/admin/providers">{{ t('common.providers') }}</NuxtLink>
      <NuxtLink to="/admin/models">{{ t('common.modelMappings') }}</NuxtLink>
      <NuxtLink to="/admin/settings">{{ t('common.settings') }}</NuxtLink>
      <div class="row" style="margin-left:auto;gap:10px">
        <LanguageSwitcher />
        <button class="row" @click="signOut"><LogOut :size="15" /> {{ t('common.signOut') }}</button>
      </div>
    </nav>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="auth.user?.mustChangePassword" class="notice" role="alert">{{ t('admin.mustChangePasswordNotice') }}</p>
    <slot />
  </div>
</template>
