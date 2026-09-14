<script setup lang="ts">
import type { AdminProvider, CanonicalModel, CatalogModel, MappingInput, ProviderMapping } from '../../../shared/types'
definePageMeta({ middleware: 'admin' })
const { request } = useAdminSession()
const { t } = useI18n()
const route = useRoute()
const providers = ref<AdminProvider[]>([])
const canonicalModels = ref<CanonicalModel[]>([])
const allMappings = ref<ProviderMapping[]>([])
const providerId = ref(Number(route.query.provider) || 0)
const rows = ref<Array<MappingInput & { localId: number }>>([])
const catalog = ref<CatalogModel[]>([])
const catalogSearch = ref('')
const busy = ref(false)
const loading = ref(true)
const error = ref('')
const notice = ref('')
const confirmed = ref(false)
const original = ref('')
let serial = 0
const payload = computed(() => rows.value.map(({ localId, ...mapping }) => mapping))
const dirty = computed(() => JSON.stringify(payload.value) !== original.value)
const catalogResults = computed(() => catalog.value.filter(model => `${model.id} ${model.name}`.toLowerCase().includes(catalogSearch.value.toLowerCase())))
function populate() {
  rows.value = allMappings.value.filter(model => model.providerId === providerId.value).map(model => ({ localId: ++serial, canonicalName: model.canonicalName, displayName: model.displayName, providerModelId: model.providerModelId, modelRevision: model.modelRevision, iconKey: model.iconKey || '', enabled: model.enabled }))
  original.value = JSON.stringify(payload.value); confirmed.value = false; catalog.value = []
}
async function load() {
  loading.value = true
  try {
    const data = await request<{ providers: AdminProvider[]; models: ProviderMapping[]; canonicalModels: CanonicalModel[] }>('/api/admin/providers')
    providers.value = data.providers; allMappings.value = data.models; canonicalModels.value = data.canonicalModels
    if (!data.providers.some(provider => provider.id === providerId.value)) providerId.value = data.providers[0]?.id ?? 0
    populate()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : t('models.loading') }
  finally { loading.value = false }
}
function changeProvider(event: Event) {
  const select = event.target as HTMLSelectElement
  if (dirty.value && !window.confirm(t('models.discardPrompt'))) { select.value = String(providerId.value); return }
  providerId.value = Number(select.value); populate(); notice.value = ''; error.value = ''
}
function add(model?: CatalogModel) {
  rows.value.push({ localId: ++serial, canonicalName: '', displayName: '', providerModelId: model?.id ?? '', modelRevision: '', iconKey: '', enabled: true })
  confirmed.value = false
}
function remove(index: number) {
  if (window.confirm(t('models.removePrompt'))) rows.value.splice(index, 1)
}
async function fetchCatalog(sync: boolean) {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    catalog.value = (await request<{ models: CatalogModel[] }>(`/api/admin/providers/${providerId.value}/catalog`, sync ? 'POST' : 'GET', sync ? {} : undefined)).models
    notice.value = t('models.catalogLoadedNotice', { n: catalog.value.length })
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not fetch catalog' }
  finally { busy.value = false }
}
async function save() {
  if (!confirmed.value) return
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await request(`/api/admin/providers/${providerId.value}/models`, 'PUT', { models: payload.value.map(mapping => ({ ...mapping, displayName: mapping.displayName?.trim() || undefined, modelRevision: mapping.modelRevision?.trim() || null, iconKey: mapping.iconKey?.trim() || null })) })
    await load()
    notice.value = t('models.savedNotice')
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not save mappings' }
  finally { busy.value = false }
}
watch(payload, () => { confirmed.value = false }, { deep: true })
onBeforeRouteLeave(() => !dirty.value || window.confirm(t('models.discardPrompt')))
onMounted(load)
</script>
<template>
  <AdminShell>
    <h1>{{ t('models.title') }}</h1>
    <p class="muted">{{ t('models.subtitle') }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p><p v-if="notice" class="success" role="status">{{ notice }}</p>
    <p v-if="loading" class="empty" role="status">{{ t('models.loading') }}</p>
    <template v-else-if="providers.length">
      <div class="panel row">
        <label style="flex:1">{{ t('models.providerLabel') }}
          <select :value="providerId" @change="changeProvider">
            <option v-for="provider in providers" :key="provider.id" :value="provider.id">
              {{ provider.name }}{{ provider.enabled ? '' : t('models.disabledSuffix') }}
            </option>
          </select>
        </label>
        <button :disabled="busy" @click="fetchCatalog(false)">{{ t('models.loadCatalog') }}</button>
        <button :disabled="busy" @click="fetchCatalog(true)">{{ t('models.syncCatalog') }}</button>
      </div>
      <details class="panel" :open="catalog.length > 0">
        <summary>{{ t('models.catalogSummary', { n: catalog.length }) }}</summary>
        <label style="margin-top:12px">{{ t('models.searchCatalog') }}<input v-model="catalogSearch" type="search" /></label>
        <div class="catalog-list">
          <div v-for="model in catalogResults" :key="model.id" class="row spread catalog-item">
            <div>
              <strong>{{ model.id }}</strong>
              <p class="muted small">{{ model.name }}<span v-if="model.contextWindow">{{ t('models.contextTokens', { n: model.contextWindow.toLocaleString() }) }}</span></p>
            </div>
            <button :disabled="rows.some(row => row.providerModelId === model.id)" @click="add(model)">
              {{ rows.some(row => row.providerModelId === model.id) ? t('models.added') : t('models.chooseMapping') }}
            </button>
          </div>
          <p v-if="!catalogResults.length" class="empty">{{ t('models.noCatalogEntries') }}</p>
        </div>
      </details>
      <form class="stack" @submit.prevent="save">
        <div class="row spread">
          <h2>{{ t('models.desiredMappings', { n: rows.length }) }}</h2>
          <button type="button" @click="add()">{{ t('models.addManualMapping') }}</button>
        </div>
        <datalist id="canonical-models"><option v-for="model in canonicalModels" :key="model.id" :value="model.canonicalName">{{ model.displayName }}</option></datalist>
        <article v-for="(row, index) in rows" :key="row.localId" class="panel field-grid">
          <div class="full row" style="gap:8px;align-items:center;margin-bottom:2px">
            <ModelLogo :canonical-name="row.canonicalName" :display-name="row.displayName" :icon-key="row.iconKey" :size="20" />
            <strong>{{ row.displayName || row.canonicalName || row.providerModelId || 'New Model' }}</strong>
          </div>
          <label>{{ t('models.providerModelId') }}<input v-model="row.providerModelId" required /></label>
          <label>{{ t('models.canonicalModelName') }}<input v-model="row.canonicalName" list="canonical-models" placeholder="e.g. openai/gpt-4.1" required /></label>
          <label>{{ t('models.displayName') }}<input v-model="row.displayName" :placeholder="t('models.displayNamePlaceholder')" /></label>
          <label>{{ t('models.brandLogo') }}
            <select v-model="row.iconKey">
              <option value="">{{ t('models.logoAuto') }}</option>
              <option value="openai">OpenAI (GPT / Codex / o1)</option>
              <option value="anthropic">Anthropic (Claude / Sonnet / Opus)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">Qwen / Alibaba</option>
              <option value="glm">GLM / Zhipu</option>
              <option value="kimi">Moonshot / Kimi</option>
              <option value="google">Google (Gemini / Gemma)</option>
              <option value="meta">Meta (Llama)</option>
              <option value="mimo">Xiaomi (Mimo)</option>
              <option value="mistral">Mistral</option>
              <option value="minimax">MiniMax</option>
            </select>
          </label>
          <label>{{ t('models.exactRevision') }}<input v-model="row.modelRevision" :placeholder="t('models.exactRevisionPlaceholder')" /></label>
          <div class="full row spread">
            <label class="check"><input v-model="row.enabled" type="checkbox" /> {{ t('models.mappingEnabled') }}</label>
            <button type="button" class="danger" @click="remove(index)">{{ t('models.removeFromDesired') }}</button>
          </div>
        </article>
        <p v-if="!rows.length" class="empty">{{ t('models.noMappingsNotice') }}</p>
        <div class="panel stack">
          <p class="notice">{{ t('models.saveNotice', { n: rows.length }) }}</p>
          <label class="check"><input v-model="confirmed" type="checkbox" required /> {{ t('models.confirmationCheckbox') }}</label>
          <div>
            <button class="primary" :disabled="busy || !confirmed">{{ busy ? t('common.saving') : t('models.confirmAndSave') }}</button>
            <span v-if="dirty" class="muted small" style="margin-left:12px">{{ t('models.unsavedChanges') }}</span>
          </div>
        </div>
      </form>
    </template>
    <p v-else class="empty">{{ t('models.noProvidersPrompt') }}</p>
  </AdminShell>
</template>
<style scoped>
.catalog-list{max-height:300px;overflow:auto;margin-top:12px}.catalog-item{padding:10px 0;border-bottom:1px solid #263349}.catalog-item>div{min-width:0;overflow-wrap:anywhere}
</style>
