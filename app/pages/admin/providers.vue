<script setup lang="ts">
import type { AdminProvider, ProviderInput } from '../../../shared/types'
definePageMeta({ middleware: 'admin' })
const { request } = useAdminSession()
const { t } = useI18n()
const providers = ref<AdminProvider[]>([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const notice = ref('')
const editing = ref<number | null>(null)
const form = ref<ProviderInput>({ name: '', slug: '', baseUrl: '', apiKey: '', iconUrl: '', enabled: true })
async function load() {
  loading.value = true
  try { providers.value = (await request<{ providers: AdminProvider[] }>('/api/admin/providers')).providers }
  catch (cause) { error.value = cause instanceof Error ? cause.message : t('providers.loading') }
  finally { loading.value = false }
}
function edit(provider?: AdminProvider) {
  editing.value = provider?.id ?? null
  form.value = provider ? { name: provider.name, slug: provider.slug, baseUrl: provider.baseUrl, apiKey: '', iconUrl: provider.iconUrl || '', enabled: provider.enabled } : { name: '', slug: '', baseUrl: '', apiKey: '', iconUrl: '', enabled: true }
  document.getElementById('provider-form')?.scrollIntoView({ behavior: 'smooth' })
}
async function save() {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const body = { ...form.value }
    if (!body.apiKey?.trim()) delete body.apiKey
    if (!body.slug?.trim()) delete body.slug
    await request(editing.value ? `/api/admin/providers/${editing.value}` : '/api/admin/providers', editing.value ? 'PATCH' : 'POST', body)
    notice.value = t('providers.savedNotice')
    edit(); await load()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not save provider' }
  finally { busy.value = false }
}
async function toggle(provider: AdminProvider) {
  busy.value = true; error.value = ''
  try { await request(`/api/admin/providers/${provider.id}`, 'PATCH', { enabled: !provider.enabled }); await load() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not update provider' }
  finally { busy.value = false }
}
async function test(provider: AdminProvider) {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    const result = await request<{ ok: boolean; modelCount: number }>(`/api/admin/providers/${provider.id}/test`, 'POST', {})
    notice.value = result.ok
      ? t('providers.testSuccess', { name: provider.name, count: result.modelCount })
      : t('providers.testFailed', { name: provider.name })
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : t('providers.testFailed', { name: provider.name }) }
  finally { busy.value = false }
}
onMounted(load)
</script>
<template>
  <AdminShell>
    <div class="row spread">
      <div>
        <h1>{{ t('providers.title') }}</h1>
        <p class="muted">{{ t('providers.subtitle') }}</p>
      </div>
      <button @click="edit()">{{ t('providers.add') }}</button>
    </div>
    <p class="notice">{{ t('providers.securityNotice') }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="loading" class="empty" role="status">{{ t('providers.loading') }}</p>
    <div v-else class="stack">
      <article v-for="provider in providers" :key="provider.id" class="panel row spread">
        <div class="stack" style="gap:5px;min-width:0">
          <div class="row" style="gap:8px;align-items:center">
            <ProviderBadge :provider-id="provider.id" :name="provider.name" :icon-url="provider.iconUrl" :size="22" />
            <h2>{{ provider.name }} <span class="badge">{{ provider.enabled ? t('common.enabled') : t('common.disabled') }}</span></h2>
          </div>
          <p class="muted small" style="overflow-wrap:anywhere">{{ provider.baseUrl }}</p>
          <span class="small">{{ provider.keyConfigured ? t('providers.encryptedKeyConfigured') : t('providers.noKeyConfigured') }}</span>
        </div>
        <div class="row">
          <button :disabled="busy" @click="test(provider)">{{ t('providers.testConnection') }}</button>
          <NuxtLink class="button" :to="`/admin/models?provider=${provider.id}`">{{ t('providers.catalogAndMappings') }}</NuxtLink>
          <button @click="edit(provider)">{{ t('common.edit') }}</button>
          <button :disabled="busy" @click="toggle(provider)">{{ provider.enabled ? t('common.disabled') : t('common.enabled') }}</button>
        </div>
      </article>
      <p v-if="!providers.length" class="empty">{{ t('providers.empty') }}</p>
    </div>
    <form id="provider-form" class="panel stack" @submit.prevent="save">
      <h2>{{ editing ? t('providers.edit') : t('providers.add') }}</h2>
      <div class="field-grid">
        <label>{{ t('providers.formName') }}<input v-model="form.name" required maxlength="120" /></label>
        <label>{{ t('providers.formSlug') }}<input v-model="form.slug" :placeholder="t('providers.formSlugPlaceholder')" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" /></label>
        <label class="full">{{ t('providers.formBaseUrl') }}<input v-model="form.baseUrl" type="url" :placeholder="t('providers.formBaseUrlPlaceholder')" required autocomplete="off" /></label>
        <label class="full">{{ t('providers.formIconUrl') }}<input v-model="form.iconUrl" type="url" :placeholder="t('providers.formIconUrlPlaceholder')" autocomplete="off" /></label>
        <label class="full">{{ t('providers.formApiKey') }} {{ editing ? t('providers.formApiKeyLeaveBlank') : '' }}<input v-model="form.apiKey" type="password" autocomplete="new-password" spellcheck="false" /></label>
        <label class="check"><input v-model="form.enabled" type="checkbox" /> {{ t('providers.formEnabled') }}</label>
      </div>
      <div class="row">
        <button class="primary" :disabled="busy">{{ busy ? t('common.saving') : t('providers.saveProvider') }}</button>
        <button v-if="editing" type="button" @click="edit()">{{ t('providers.cancelEditing') }}</button>
      </div>
    </form>
  </AdminShell>
</template>
