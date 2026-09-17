<script setup lang="ts">
import { Activity, Search, List, LayoutGrid, Menu, X, RefreshCw, Settings, ChevronRight, Info, AlertTriangle, Link2, Check, Timer, Gauge, Zap } from 'lucide-vue-next'
import type { PublicOverview, ModelHistory, CanonicalModel, MonitorStatus, HistoryPoint, HistoryBucket, ProviderHistory } from '../../shared/types'

const { t, formatDate, formatNumber, setDateFormat, formatRelativeTime } = useI18n()
const route = useRoute()
const router = useRouter()

const overview = ref<PublicOverview | null>(null)
const history = ref<ModelHistory | null>(null)
const loading = ref(true)
const historyLoading = ref(false)
const error = ref('')
const historyError = ref('')
const search = ref('')
const statusFilter = ref('all')
const providerFilter = ref(typeof route.query.provider === 'string' ? route.query.provider : 'all')
const includeInactive = ref(false)
const sortBy = ref<'name-asc' | 'name-desc' | 'ttft-asc' | 'ttft-desc' | 'rate-desc' | 'rate-asc'>('name-asc')
const listMode = ref<'list' | 'cards'>('list')
const panelWidth = ref(280)
const drawer = ref(false)
const sidebar = ref<HTMLElement | null>(null)
const drawerButton = ref<HTMLButtonElement | null>(null)
const metric = ref<'ttftMs' | 'totalMs' | 'ratePerSec'>('ttftMs')
const providerIds = ref<number[]>([])
const sampleDialog = ref<HTMLDialogElement | null>(null)
const notesDialog = ref<HTMLDialogElement | null>(null)
const workerDialog = ref<HTMLDialogElement | null>(null)
const selectedSamples = ref<Array<{ point: HistoryPoint; provider: string }>>([])
const detailTitle = ref('')
const detailBucket = ref<HistoryBucket | null>(null)
const customFrom = ref('')
const customTo = ref('')
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | undefined

async function copyModelLink() {
  if (!import.meta.client) return
  try {
    const url = `${window.location.origin}/?model=${selectedId.value}`
    await navigator.clipboard.writeText(url)
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Fallback
  }
}
let timer: number | undefined
let historyRequest = 0
let overviewRequest = 0
let resizeStart: { x: number; width: number } | null = null

const statuses: MonitorStatus[] = ['up', 'slow', 'down', 'stale', 'no-data', 'configuration-error']
const rangeDays: Record<string, number> = { '6h': 0.25, '12h': 0.5, '24h': 1, '7d': 7 }
const selectedId = computed(() => Number(route.query.model || route.params.id) || overview.value?.models[0]?.id || 0)
const range = computed(() => ['6h', '12h', '24h', '7d', 'custom'].includes(String(route.query.range)) ? String(route.query.range) : '6h')
const profile = computed(() => typeof route.query.profile === 'string' ? route.query.profile : '')
const selectedModel = computed(() => overview.value?.models.find(model => model.id === selectedId.value))

const providerColors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#2dd4bf', '#818cf8', '#60a5fa', '#fb7185']
function getProviderColor(id: number | string) {
  const num = typeof id === 'number' ? id : Array.from(String(id)).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return providerColors[(Math.abs(num) - 1) % providerColors.length] || providerColors[0]
}

const monitorsByModel = computed(() => {
  const grouped = new Map<number, PublicOverview['monitors']>()
  for (const monitor of overview.value?.monitors ?? []) {
    const existing = grouped.get(monitor.modelId)
    if (existing) existing.push(monitor)
    else grouped.set(monitor.modelId, [monitor])
  }
  return grouped
})
const availableProviders = computed(() => {
  const all = overview.value?.providers ?? []
  return includeInactive.value ? all : all.filter(p => p.enabled)
})

function modelMonitors(id: number) {
  const list = monitorsByModel.value.get(id) ?? []
  return includeInactive.value ? list : list.filter(m => m.enabled)
}
function primaryMonitor(id: number) {
  const list = modelMonitors(id)
  return list[0]
}

const filteredModels = computed(() => {
  const list = (overview.value?.models ?? []).filter(model => {
    if (!`${model.displayName} ${model.canonicalName}`.toLowerCase().includes(search.value.toLowerCase())) return false
    const monitors = modelMonitors(model.id)
    if (!includeInactive.value && !monitors.length) return false
    return monitors.some(monitor => (providerFilter.value === 'all' || monitor.providerId === Number(providerFilter.value)) && (statusFilter.value === 'all' || monitor.status === statusFilter.value)) || (!monitors.length && statusFilter.value === 'all' && providerFilter.value === 'all')
  })
  return list.sort((a, b) => {
    if (sortBy.value === 'name-asc') return a.displayName.localeCompare(b.displayName)
    if (sortBy.value === 'name-desc') return b.displayName.localeCompare(a.displayName)
    const monA = primaryMonitor(a.id)
    const monB = primaryMonitor(b.id)
    if (sortBy.value === 'ttft-asc') {
      const valA = monA?.ttftMs != null ? monA.ttftMs : Infinity
      const valB = monB?.ttftMs != null ? monB.ttftMs : Infinity
      return valA - valB
    }
    if (sortBy.value === 'ttft-desc') {
      const valA = monA?.ttftMs != null ? monA.ttftMs : -1
      const valB = monB?.ttftMs != null ? monB.ttftMs : -1
      return valB - valA
    }
    if (sortBy.value === 'rate-desc') {
      const valA = monA?.ratePerSec != null ? monA.ratePerSec : -1
      const valB = monB?.ratePerSec != null ? monB.ratePerSec : -1
      return valB - valA
    }
    if (sortBy.value === 'rate-asc') {
      const valA = monA?.ratePerSec != null ? monA.ratePerSec : Infinity
      const valB = monB?.ratePerSec != null ? monB.ratePerSec : Infinity
      return valA - valB
    }
    return 0
  })
})

const multiProviderCount = computed(() => {
  return (overview.value?.models ?? []).filter(model => modelMonitors(model.id).length > 1).length
})

const providerRecap = computed(() => {
  const providers = includeInactive.value ? (overview.value?.providers ?? []) : (overview.value?.providers ?? []).filter(p => p.enabled)
  return providers.map(provider => {
    const count = (overview.value?.monitors ?? []).filter(m => m.providerId === provider.id && (includeInactive.value || m.enabled)).length
    return { id: provider.id, name: provider.name, count }
  })
})
const visibleSeries = computed(() => history.value?.series.filter(series => providerIds.value.includes(series.provider.id)) ?? [])
const sampleRows = computed(() => visibleSeries.value.flatMap(series => series.points.map(point => ({ point, provider: series.provider.name }))).sort((a, b) => b.point.ts - a.point.ts))
const samplePage = ref(0)
const samplePageSize = 100
const displayedSamples = computed(() => sampleRows.value.slice(samplePage.value * samplePageSize, (samplePage.value + 1) * samplePageSize))
watch(sampleRows, () => { samplePage.value = 0 })

function number(value: number | null | undefined, unit = '') { return formatNumber(value, unit) }
function date(value: number | null | undefined) { return formatDate(value) }
function localDate(value: number) { const d = new Date(value); return new Date(value - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

async function query(update: Record<string, string | undefined>) { await router.replace({ query: { ...route.query, ...update } }) }
async function selectModel(model: CanonicalModel) {
  await query({ model: String(model.id) })
  closeDrawer()
}

function closeDrawer() { if (drawer.value) { drawer.value = false; nextTick(() => drawerButton.value?.focus()) } }
async function openDrawer() { drawer.value = true; await nextTick(); sidebar.value?.querySelector<HTMLInputElement>('input')?.focus() }
function trapDrawer(event: KeyboardEvent) {
  if (!drawer.value) return
  if (event.key === 'Escape') { closeDrawer(); return }
  if (event.key !== 'Tab') return
  const elements = Array.from(sidebar.value?.querySelectorAll<HTMLElement>('button,input,select,a') ?? []).filter(element => element.offsetParent !== null)
  const first = elements[0]; const last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}

function savePreferences() {
  try {
    localStorage.setItem('probelm-workspace', JSON.stringify({ listMode: listMode.value, panelWidth: panelWidth.value, sortBy: sortBy.value }))
  } catch { /* Ignore */ }
}
watch([listMode, panelWidth, sortBy], savePreferences)
watch(providerFilter, (val) => {
  try { localStorage.setItem('probelm-provider-filter', val) } catch { /* Ignore */ }
})

function resizeMove(event: PointerEvent) { if (resizeStart) panelWidth.value = Math.max(220, Math.min(460, resizeStart.width + event.clientX - resizeStart.x)) }
function resizeEnd() { resizeStart = null; window.removeEventListener('pointermove', resizeMove); window.removeEventListener('pointerup', resizeEnd); window.removeEventListener('pointercancel', resizeEnd) }
function resizeBegin(event: PointerEvent) { event.preventDefault(); resizeStart = { x: event.clientX, width: panelWidth.value }; window.addEventListener('pointermove', resizeMove); window.addEventListener('pointerup', resizeEnd); window.addEventListener('pointercancel', resizeEnd) }
function resizeKey(event: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  panelWidth.value = event.key === 'Home' ? 220 : event.key === 'End' ? 460 : Math.max(220, Math.min(460, panelWidth.value + (event.key === 'ArrowRight' ? 10 : -10)))
}

async function loadOverview() {
  const request = ++overviewRequest
  try {
    const response = await fetch('/api/overview')
    if (!response.ok) throw new Error(`Overview unavailable (${response.status}).`)
    const data = await response.json() as PublicOverview
    if (request !== overviewRequest) return
    overview.value = data
    if (data.dateFormat) setDateFormat(data.dateFormat)
    error.value = ''
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not load overview.' }
  finally { loading.value = false }
}

async function loadHistory(resetProviders = false) {
  const request = ++historyRequest
  if (!selectedId.value) { history.value = null; return }
  historyLoading.value = true; historyError.value = ''
  const to = range.value === 'custom' ? Number(route.query.to) : Date.now()
  const from = range.value === 'custom' ? Number(route.query.from) : to - (rangeDays[range.value] ?? 0.25) * 86400000
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 366 * 86400000) { history.value = null; historyError.value = 'Choose a valid range up to 366 days.'; historyLoading.value = false; return }
  customFrom.value = localDate(from); customTo.value = localDate(to)
  const params = new URLSearchParams({ from: String(from), to: String(to) })
  if (profile.value) params.set('profile', profile.value)
  if (includeInactive.value) params.set('includeInactive', 'true')
  try {
    const response = await fetch(`/api/models/${selectedId.value}/history?${params}`)
    if (!response.ok) throw new Error(`History unavailable (${response.status}).`)
    const data = await response.json() as ModelHistory
    if (request !== historyRequest) return
    history.value = data
    if (resetProviders || !providerIds.value.length) {
      providerIds.value = data.series.map(s => s.provider.id)
    } else {
      const existing = providerIds.value.filter(id => data.series.some(s => s.provider.id === id))
      providerIds.value = existing.length ? existing : data.series.map(s => s.provider.id)
    }
  } catch (cause) { if (request === historyRequest) { history.value = null; historyError.value = cause instanceof Error ? cause.message : 'Could not load history.' } }
  finally { if (request === historyRequest) historyLoading.value = false }
}

async function refresh() { await loadOverview(); await loadHistory(!history.value) }

function applyCustom() {
  const from = new Date(customFrom.value).getTime(); const to = new Date(customTo.value).getTime()
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to || to - from > 366 * 86400000) { historyError.value = 'Choose an end after the start, with at most 366 days.'; return }
  void query({ range: 'custom', from: String(from), to: String(to) })
}

function setRange(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === 'custom') { void query({ range: 'custom', from: String(new Date(customFrom.value).getTime() || Date.now() - 21600000), to: String(new Date(customTo.value).getTime() || Date.now()) }); return }
  void query({ range: value, from: undefined, to: undefined })
}

function openSample(point: HistoryPoint, provider: string) { detailTitle.value = `${provider} · sample`; detailBucket.value = null; selectedSamples.value = [{ point, provider }]; sampleDialog.value?.showModal() }
function openBucket(series: ProviderHistory, bucket: HistoryBucket) {
  detailTitle.value = `${series.provider.name} · ${date(bucket.start)}`; detailBucket.value = bucket
  selectedSamples.value = series.points.filter(point => point.ts >= bucket.start && point.ts < bucket.end).map(point => ({ point, provider: series.provider.name }))
  sampleDialog.value?.showModal()
}

watch(() => [selectedId.value, range.value, profile.value, route.query.from, route.query.to], (value, previous) => {
  if (!overview.value) return
  const modelChanged = value[0] !== previous[0]
  history.value = null
  void loadHistory(modelChanged || value[2] !== previous[2] || providerIds.value.length === 0)
})

onMounted(async () => {
  try {
    const preferences = JSON.parse(localStorage.getItem('probelm-workspace') || '{}')
    if (preferences.listMode === 'cards' || preferences.listMode === 'list') listMode.value = preferences.listMode
    if (preferences.sortBy) sortBy.value = preferences.sortBy
    if (Number.isFinite(preferences.panelWidth)) panelWidth.value = Math.max(220, Math.min(460, preferences.panelWidth))
    const storedFilter = localStorage.getItem('probelm-provider-filter')
    if (storedFilter && typeof route.query.provider !== 'string') providerFilter.value = storedFilter
    const storedIncludeInactive = localStorage.getItem('probelm-include-inactive')
    if (storedIncludeInactive !== null) includeInactive.value = storedIncludeInactive === 'true'
  } catch { /* Use defaults */ }
  await loadOverview()
  if (!historyLoading.value) await loadHistory(true)
  timer = window.setInterval(refresh, 60000)
})

watch(includeInactive, (val) => {
  try { localStorage.setItem('probelm-include-inactive', String(val)) } catch {}
  void loadHistory(true)
})

onUnmounted(() => { if (timer) clearInterval(timer); resizeEnd(); ++historyRequest; ++overviewRequest })
</script>

<template>
  <div class="workspace" :style="{ '--sidebar-width': `${panelWidth}px` }">
    <header class="workspace-header">
      <div class="row">
        <button ref="drawerButton" class="icon-button mobile-only" :aria-label="t('workspace.openSelector')" :aria-expanded="drawer" @click="openDrawer"><Menu /></button>
        <NuxtLink class="brand row" to="/"><Activity :size="22" /><strong>{{ t('common.brand') }}</strong></NuxtLink>
        <span class="muted small desktop-only">{{ t('common.tagline') }}</span>
      </div>
      <div class="row header-actions" style="gap: 10px; align-items: center;">
        <button
          v-if="overview"
          type="button"
          class="worker-badge-btn"
          :class="overview.worker.online ? 'success' : 'danger'"
          :title="t('workspace.workerModalTitle')"
          :aria-label="t('workspace.workerModalTitle')"
          @click="workerDialog?.showModal()"
        >
          <span class="worker-dot" :class="{ pulsing: overview.worker.online, offline: !overview.worker.online }" />
          <span class="worker-badge-label-long desktop-only">{{ overview.worker.online ? t('common.workerOnline') : t('common.workerOffline') }}</span>
          <span class="worker-badge-label-short mobile-only">{{ overview.worker.online ? 'Online' : 'Offline' }}</span>
        </button>
        <button class="icon-button" :disabled="loading || historyLoading" :aria-label="t('common.refresh')" @click="refresh">
          <RefreshCw :size="15" />
        </button>
        <ThemeToggle />
        <LanguageSwitcher />
        <NuxtLink to="/admin/providers" :aria-label="t('common.administration')">
          <Settings :size="18" />
        </NuxtLink>
      </div>
    </header>
    <div v-if="drawer" class="drawer-backdrop" @click="closeDrawer" />
    <div class="workspace-body">
      <aside ref="sidebar" class="model-sidebar" :class="{ 'drawer-open': drawer }" :role="drawer ? 'dialog' : undefined" :aria-modal="drawer ? true : undefined" :aria-label="t('workspace.searchAria')" @keydown="trapDrawer">
        <div class="selector-controls stack">
          <div class="row spread">
            <h2>{{ t('workspace.models') }} <span class="muted small">{{ filteredModels.length }}</span></h2>
            <div class="row view-mode-controls">
              <button class="icon-button" :aria-pressed="listMode === 'list'" :aria-label="t('workspace.listView')" @click="listMode = 'list'"><List :size="15" /></button>
              <button class="icon-button" :aria-pressed="listMode === 'cards'" :aria-label="t('workspace.cardView')" @click="listMode = 'cards'"><LayoutGrid :size="15" /></button>
              <button class="icon-button mobile-only" :aria-label="t('workspace.closeSelector')" @click="closeDrawer"><X :size="15" /></button>
            </div>
          </div>
          <label class="search-box">
            <Search :size="14" />
            <input v-model="search" type="search" :placeholder="t('workspace.searchPlaceholder')" :aria-label="t('workspace.searchAria')" />
          </label>
          <div class="filter-grid">
            <label>{{ t('workspace.statusLabel') }}
              <select v-model="statusFilter">
                <option value="all">{{ t('status.all') }}</option>
                <option v-for="status in statuses" :key="status" :value="status">{{ status }}</option>
              </select>
            </label>
            <label>{{ t('workspace.providerLabel') }}
              <select v-model="providerFilter">
                <option value="all">{{ t('workspace.allProviders') }}</option>
                <option v-for="provider in availableProviders" :key="provider.id" :value="String(provider.id)">
                  {{ provider.name }}{{ !provider.enabled ? t('workspace.inactiveSuffix') : '' }}
                </option>
              </select>
            </label>
          </div>
          <div class="row spread filter-options" style="margin-top: 2px;">
            <label class="check small">
              <input v-model="includeInactive" type="checkbox" />
              <span>{{ t('workspace.includeInactive') }}</span>
            </label>
          </div>
          <label class="sort-field">
            <span class="muted small">{{ t('workspace.sortLabel') }}</span>
            <select v-model="sortBy">
              <option value="name-asc">{{ t('workspace.sortNameAsc') }}</option>
              <option value="name-desc">{{ t('workspace.sortNameDesc') }}</option>
              <option value="ttft-asc">{{ t('workspace.sortTtftAsc') }}</option>
              <option value="ttft-desc">{{ t('workspace.sortTtftDesc') }}</option>
              <option value="rate-desc">{{ t('workspace.sortRateDesc') }}</option>
              <option value="rate-asc">{{ t('workspace.sortRateAsc') }}</option>
            </select>
          </label>
        </div>
        <div class="model-list" :class="listMode">
          <p v-if="loading" class="empty" role="status">{{ t('workspace.loadingModels') }}</p>
          <p v-else-if="error && !overview" class="error" role="alert">{{ error }} <button @click="loadOverview">{{ t('common.retry') }}</button></p>
          <p v-else-if="!filteredModels.length" class="empty">{{ overview?.models.length ? t('workspace.noModelsMatch') : t('workspace.noModelsConfigured') }}</p>
          <template v-else>
            <button
              v-for="model in filteredModels"
              :key="model.id"
              class="model-item"
              :class="listMode"
              :aria-pressed="selectedId === model.id"
              @click="selectModel(model)"
            >
              <template v-if="listMode === 'list'">
                <div class="list-item-main row" style="gap:8px;min-width:0;flex:1">
                  <ModelLogo :canonical-name="model.canonicalName" :display-name="model.displayName" :icon-key="model.iconKey" :size="16" />
                  <div class="list-item-names" style="min-width:0;flex:1">
                    <strong class="model-title-text">{{ model.displayName }}</strong>
                    <span class="canonical-subtext muted">{{ model.canonicalName }}</span>
                  </div>
                </div>
                <div class="list-item-right row" style="gap:4px">
                  <span v-if="primaryMonitor(model.id)?.ttftMs != null" class="ttft-badge">{{ number(primaryMonitor(model.id)?.ttftMs, ' ms') }}</span>
                  <ChevronRight :size="13" class="muted" />
                </div>
              </template>
              <template v-else>
                <div class="row spread">
                  <div class="row" style="gap:7px;align-items:center;min-width:0">
                    <ModelLogo :canonical-name="model.canonicalName" :display-name="model.displayName" :icon-key="model.iconKey" :size="16" />
                    <strong style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ model.displayName }}</strong>
                  </div>
                  <ChevronRight :size="14" />
                </div>
                <span class="canonical-name muted">{{ model.canonicalName }}</span>
                <div class="model-providers">
                  <span v-for="monitor in modelMonitors(model.id)" :key="monitor.id" class="provider-chip" :title="`${monitor.providerName}: ${monitor.status}; last probe ${date(monitor.lastProbeAt)}`">
                    <ProviderBadge :provider-id="monitor.providerId" :name="monitor.providerName" :size="12" />
                    <span>{{ monitor.providerName }}</span>
                    <span class="muted">{{ number(monitor.ttftMs, ' ms') }}</span>
                  </span>
                  <span v-if="!modelMonitors(model.id).length" class="muted small">{{ t('workspace.noMappedProviders') }}</span>
                </div>
              </template>
            </button>
          </template>
        </div>
        <div class="sidebar-footer small">
          <div class="row spread" style="margin-bottom: 6px;">
            <strong>{{ overview?.models.length ?? 0 }} {{ t('workspace.models').toLowerCase() }}</strong>
            <span v-if="multiProviderCount" class="multi-provider-badge">
              {{ t('workspace.multiProviderSummary', { n: multiProviderCount }) }}
            </span>
          </div>
          <div class="provider-recap-grid">
            <span v-for="p in providerRecap" :key="p.name" class="provider-recap-chip">
              {{ p.name }}: <strong>{{ p.count }}</strong>
            </span>
          </div>
        </div>
      </aside>
      <div class="resize-handle" role="separator" tabindex="0" :aria-label="t('workspace.resizeAria')" aria-orientation="vertical" :aria-valuenow="panelWidth" :aria-valuemin="220" :aria-valuemax="460" @pointerdown="resizeBegin" @keydown="resizeKey" />
      <main class="model-detail" :inert="drawer || undefined">
        <div v-if="error && overview" class="error small" role="alert">{{ error }} {{ t('workspace.showingLastReceived') }}</div>
        <div v-if="!selectedId" class="empty">{{ t('workspace.selectModelPrompt') }} <NuxtLink to="/login">{{ t('workspace.adminSignIn') }}</NuxtLink></div>
        <template v-else>
          <section class="detail-heading">
            <div class="row spread" style="align-items: flex-start; flex-wrap: wrap; gap: 10px;">
              <div>
                <p class="eyebrow">{{ t('workspace.canonicalModel') }}</p>
                <div class="row" style="gap: 10px; align-items: center; flex-wrap: wrap;">
                  <ModelLogo :canonical-name="selectedModel?.canonicalName || history?.model.canonicalName" :display-name="selectedModel?.displayName || history?.model.displayName" :icon-key="selectedModel?.iconKey || history?.model.iconKey" :size="24" />
                  <h1>{{ selectedModel?.displayName ?? history?.model.displayName ?? `Model #${selectedId}` }}</h1>
                  <button
                    type="button"
                    class="action-icon-btn copy-link-btn"
                    :class="{ copied }"
                    :title="copied ? t('workspace.copied') : t('workspace.copyLink')"
                    :aria-label="copied ? t('workspace.copied') : t('workspace.copyLink')"
                    @click="copyModelLink"
                  >
                    <Check v-if="copied" :size="15" class="copy-success-icon" />
                    <Link2 v-else :size="15" />
                  </button>
                  <button
                    type="button"
                    class="action-icon-btn info-btn"
                    :title="t('workspace.measurementNotesModalTitle')"
                    :aria-label="t('workspace.measurementNotesModalTitle')"
                    @click="notesDialog?.showModal()"
                  >
                    <Info :size="15" />
                  </button>
                </div>
                <p class="muted small">{{ selectedModel?.canonicalName ?? history?.model.canonicalName }}</p>
              </div>
              <div class="range-controls">
                <label>{{ t('workspace.timeRange') }}
                  <select :value="range" @change="setRange">
                    <option value="6h">{{ t('workspace.last6h') }}</option>
                    <option value="12h">{{ t('workspace.last12h') }}</option>
                    <option value="24h">{{ t('workspace.last24h') }}</option>
                    <option value="7d">{{ t('workspace.last7d') }}</option>
                    <option value="custom">{{ t('workspace.customRange') }}</option>
                  </select>
                </label>
              </div>
            </div>
            <form v-if="range === 'custom'" class="row custom-range" @submit.prevent="applyCustom">
              <label>{{ t('workspace.fromLocal') }}<input v-model="customFrom" type="datetime-local" required /></label>
              <label>{{ t('workspace.toLocal') }}<input v-model="customTo" type="datetime-local" required /></label>
              <button>{{ t('workspace.applyRange') }}</button>
            </form>
          </section>
          <section class="chart-card panel" aria-label="Primary model chart">
            <div class="row spread chart-card-header">
              <div class="row metric-tabs" role="group" aria-label="Chart metric">
                <button class="metric-tab" :aria-pressed="metric === 'ttftMs'" :title="t('workspace.ttftHelp')" @click="metric = 'ttftMs'"><Timer :size="20" aria-hidden="true" /><span><strong>{{ t('workspace.ttft') }}</strong><small>{{ t('workspace.ttftHelp') }}</small></span></button>
                <button class="metric-tab" :aria-pressed="metric === 'totalMs'" :title="t('workspace.totalLatencyHelp')" @click="metric = 'totalMs'"><Gauge :size="20" aria-hidden="true" /><span><strong>{{ t('workspace.totalLatency') }}</strong><small>{{ t('workspace.totalLatencyHelp') }}</small></span></button>
                <button class="metric-tab" :aria-pressed="metric === 'ratePerSec'" :title="t('workspace.throughputHelp')" @click="metric = 'ratePerSec'"><Zap :size="20" aria-hidden="true" /><span><strong>{{ t('workspace.throughput') }}</strong><small>{{ t('workspace.throughputHelp') }}</small></span></button>
              </div>
              <span class="muted small samples-info-text">{{ t('workspace.samplesInfo', { n: sampleRows.length.toLocaleString() }) }}</span>
            </div>
            <div v-if="history" class="provider-overlays provider-comparison-chips" role="group" aria-label="Provider overlays">
              <label v-for="series in history.series" :key="series.provider.id" class="check provider-comparison-chip">
                <input v-model="providerIds" type="checkbox" :value="series.provider.id" />
                <ProviderBadge :provider-id="series.provider.id" :name="series.provider.name" :icon-url="series.provider.iconUrl" :size="14" />
                <span>{{ series.provider.name }}</span>
              </label>
              <span v-if="!history.series.length" class="muted small">{{ t('workspace.noProvidersInProfile') }}</span>
            </div>
            <div v-if="visibleSeries.length" class="compact-provider-grid">
              <div v-for="series in visibleSeries" :key="series.provider.id" class="compact-provider-card">
                <div class="row" style="gap:6px;align-items:center">
                  <ProviderBadge :provider-id="series.provider.id" :name="series.provider.name" :icon-url="series.provider.iconUrl" :size="15" />
                  <strong class="small" :style="{ color: getProviderColor(series.provider.id) }">{{ series.provider.name }}</strong>
                </div>
                <div class="compact-stats">
                  <span :title="t('workspace.observedSuccess')">Success: <strong>{{ number(series.summary.successRate == null ? null : series.summary.successRate * 100, '%') }}</strong></span>
                  <span title="p50 TTFT">p50: <strong>{{ number(series.summary.p50TtftMs, ' ms') }}</strong></span>
                  <span :title="t('workspace.meanThroughput')">Rate: <strong>{{ number(series.summary.avgRatePerSec, ' tok/s') }}</strong></span>
                </div>
              </div>
            </div>
            <p v-if="historyLoading && !history" class="empty" role="status">{{ t('workspace.loadingHistory') }}</p>
            <div v-else-if="historyError" class="error" role="alert">{{ historyError }} <button @click="loadHistory(true)">{{ t('common.retry') }}</button></div>
            <div v-else-if="history && visibleSeries.length" class="primary-chart"><HistoryChart :series="visibleSeries" :metric="metric" :from="history.from" :to="history.to" :interval-minutes="overview?.intervalMinutes ?? 5" @sample="openSample" /><p v-if="!sampleRows.length" class="chart-empty muted">{{ t('workspace.noObservationsRange') }}</p></div>
            <p v-else class="empty">{{ history?.series.length ? t('workspace.selectProviderOverlay') : t('workspace.noMeasurementsYet') }}</p>
            <p v-if="history?.truncated" class="notice small">{{ t('workspace.limitNotice') }}</p>
          </section>
          <section v-if="history" class="history-panel" aria-label="Provider uptime and samples">
            <div class="timeline-heading">
              <div>
                <p class="eyebrow">{{ t('workspace.statusTimelineEyebrow') }}</p>
                <h2>{{ t('workspace.statusTimelineTitle') }}</h2>
              </div>
              <div class="status-legend"><span v-for="status in statuses" :key="status" class="small"><span class="dot" :class="status" /> {{ status }}</span></div>
            </div>
            <article v-for="series in visibleSeries" :key="series.provider.id" class="provider-history panel">
              <div class="row spread">
                <h2 class="row" style="gap:8px;align-items:center">
                  <ProviderBadge :provider-id="series.provider.id" :name="series.provider.name" :icon-url="series.provider.iconUrl" :size="18" />
                  <span :style="{ color: getProviderColor(series.provider.id) }">{{ series.provider.name }}</span>
                  <span class="badge status-text" :class="series.status">{{ series.status }}</span>
                </h2>
                <span class="muted small">{{ t('workspace.revision') }}: {{ series.modelRevision || t('workspace.unspecified') }} · {{ series.summary.samples.toLocaleString() }} samples</span>
              </div>
              <div class="history-blocks-wrapper">
                <div class="history-blocks" :aria-label="`${series.provider.name} status timeline`"><button v-for="bucket in series.buckets" :key="bucket.start" class="history-block" :class="bucket.status" :aria-label="`${date(bucket.start)} to ${date(bucket.end)}: ${bucket.status}, ${bucket.samples} samples, ${bucket.failures} failures, ${bucket.missing} missing. Open details.`" :title="`${date(bucket.start)} – ${date(bucket.end)}\n${bucket.status} · ${bucket.samples} samples · ${bucket.failures} failures · ${bucket.missing} missing`" @click="openBucket(series, bucket)" /></div>
              </div>
              <div class="row spread muted small"><span>{{ date(history.from) }}</span><span>{{ date(history.to) }}</span></div>
            </article>
            <details class="panel sample-details" open>
              <summary>{{ t('workspace.sampleTableSummary', { n: sampleRows.length.toLocaleString() }) }}</summary>
              <p class="muted small" style="margin:8px 0">{{ t('workspace.sampleTableNote') }}</p>
              <div class="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{{ t('workspace.colTime') }}</th>
                      <th>{{ t('workspace.colProvider') }}</th>
                      <th>{{ t('workspace.colStatus') }}</th>
                      <th>{{ t('workspace.colTtft') }}</th>
                      <th>{{ t('workspace.colTotal') }}</th>
                      <th>{{ t('workspace.colThroughput') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="row in displayedSamples" :key="`${row.provider}-${row.point.runId}-${row.point.ts}`">
                      <td><button class="time-btn" @click="openSample(row.point, row.provider)">{{ date(row.point.ts) }}</button></td>
                      <td>{{ row.provider }}</td>
                      <td class="status-text" :class="row.point.status">{{ row.point.status }}</td>
                      <td>
                        <span v-if="row.point.ttftMs != null">{{ number(row.point.ttftMs, ' ms') }}</span>
                        <span v-else-if="row.point.error" class="error-pill" :title="row.point.error">{{ row.point.error.length > 25 ? row.point.error.slice(0, 25) + '…' : row.point.error }}</span>
                        <span v-else class="muted">—</span>
                      </td>
                      <td>{{ number(row.point.totalMs, ' ms') }}</td>
                      <td>{{ number(row.point.ratePerSec, ' tok/s') }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </template>
      </main>
    </div>
    <dialog ref="sampleDialog" aria-labelledby="sample-title">
      <div class="row spread">
        <h2 id="sample-title">{{ detailTitle }}</h2>
        <button class="icon-button" :aria-label="t('workspace.closeSampleDetails')" @click="sampleDialog?.close()"><X :size="15" /></button>
      </div>
      <p v-if="detailBucket" class="muted small" style="margin-top:12px">
        {{ t('workspace.sampleSummary', { status: detailBucket.status, samples: detailBucket.samples, failures: detailBucket.failures, missing: detailBucket.missing }) }}
      </p>
      <p v-if="!selectedSamples.length" class="empty">{{ t('workspace.noObservationRecorded') }}</p>
      <article v-for="row in selectedSamples" :key="`${row.provider}-${row.point.runId}-${row.point.ts}`" class="sample-record">
        <h3>{{ row.provider }} · {{ date(row.point.ts) }}</h3>
        <div class="provider-metrics">
          <div><span>{{ t('workspace.colStatus') }}</span><strong class="status-text" :class="row.point.status">{{ row.point.status }}</strong></div>
          <div><span>{{ t('workspace.colTtft') }}</span><strong>{{ number(row.point.ttftMs, ' ms') }}</strong></div>
          <div><span>{{ t('workspace.colTotal') }}</span><strong>{{ number(row.point.totalMs, ' ms') }}</strong></div>
          <div><span>{{ t('workspace.colThroughput') }}</span><strong>{{ number(row.point.ratePerSec, ' tok/s') }}</strong></div>
          <div><span>{{ t('workspace.httpStatus') }}</span><strong>{{ row.point.httpCode ?? '—' }}</strong></div>
          <div><span>{{ t('workspace.tokensObserved') }}</span><strong>{{ row.point.tokens ?? '—' }}</strong></div>
          <div><span>{{ t('workspace.runId') }}</span><strong>#{{ row.point.runId }}</strong></div>
        </div>
        <div v-if="row.point.error" class="error-diag-card">
          <div class="row" style="gap: 6px; align-items: center; color: #f87171; font-weight: 600; font-size: 11px;">
            <AlertTriangle :size="14" />
            <span>{{ t('workspace.errorLogTitle') }}</span>
          </div>
          <p class="error-message-text">{{ row.point.error }}</p>
        </div>
      </article>
    </dialog>
    <dialog ref="notesDialog" aria-labelledby="notes-title" style="max-width: 540px;">
      <div class="row spread">
        <h2 id="notes-title">{{ t('workspace.measurementNotesModalTitle') }}</h2>
        <button class="icon-button" :aria-label="t('workspace.closeSampleDetails')" @click="notesDialog?.close()"><X :size="15" /></button>
      </div>
      <div v-if="history" class="stack small muted" style="margin-top: 14px; line-height: 1.6; gap: 10px;">
        <p><strong>TTFT:</strong> {{ history.measurements.ttft }}</p>
        <p><strong>Throughput:</strong> {{ history.measurements.throughput }}</p>
        <p><strong>Tokens:</strong> {{ history.measurements.tokens }}</p>
        <p style="border-top: 1px solid #263349; padding-top: 10px;">{{ t('workspace.measurementNotesDisclaimer') }}</p>
      </div>
    </dialog>
    <dialog ref="workerDialog" aria-labelledby="worker-modal-title" style="max-width: 480px;">
      <div class="row spread">
        <h2 id="worker-modal-title" class="row" style="gap: 8px;">
          <Activity :size="18" />
          {{ t('workspace.workerModalTitle') }}
        </h2>
        <button class="icon-button" :aria-label="t('workspace.closeSampleDetails')" @click="workerDialog?.close()"><X :size="15" /></button>
      </div>
      <div v-if="overview" class="stack small" style="margin-top: 14px; gap: 12px;">
        <div class="row spread panel" style="padding: 10px 14px; margin: 0;">
          <div class="row" style="gap: 8px;">
            <span class="worker-dot" :class="{ pulsing: overview.worker.online, offline: !overview.worker.online }" style="width: 9px; height: 9px;" />
            <strong>{{ overview.worker.online ? t('settings.heartbeatHealthy') : t('settings.workerOfflineStale') }}</strong>
          </div>
          <span v-if="overview.worker.lastRunStatus" class="badge" :class="overview.worker.lastRunStatus === 'completed' ? 'success' : 'danger'">
            {{ overview.worker.lastRunStatus }}
          </span>
        </div>
        <div class="worker-info-grid">
          <div class="worker-info-item">
            <span class="muted">{{ t('settings.lastHeartbeat') }}</span>
            <strong>{{ formatRelativeTime(overview.worker.heartbeatAt, t('common.never')) }}</strong>
            <span v-if="overview.worker.heartbeatAt" class="muted tiny">{{ formatDate(overview.worker.heartbeatAt) }}</span>
          </div>
          <div class="worker-info-item">
            <span class="muted">{{ t('settings.lastRun') }}</span>
            <strong>{{ formatRelativeTime(overview.worker.lastRunAt, t('common.never')) }}</strong>
            <span v-if="overview.worker.lastRunAt" class="muted tiny">{{ formatDate(overview.worker.lastRunAt) }}</span>
          </div>
          <div class="worker-info-item">
            <span class="muted">{{ t('settings.nextRun') }}</span>
            <strong>{{ formatRelativeTime(overview.worker.nextRunAt, t('common.notScheduled')) }}</strong>
            <span v-if="overview.worker.nextRunAt" class="muted tiny">{{ formatDate(overview.worker.nextRunAt) }}</span>
          </div>
          <div class="worker-info-item">
            <span class="muted">{{ t('workspace.lastRunDuration') }}</span>
            <strong>{{ overview.worker.lastRunDurationMs != null ? (overview.worker.lastRunDurationMs / 1000).toFixed(1) + 's' : '—' }}</strong>
            <span class="muted tiny">{{ overview.worker.activeRunId ? t('common.running', { n: overview.worker.activeRunId }) : t('common.idle') }}</span>
          </div>
        </div>
        <div class="panel" style="padding: 10px 14px; margin: 0; background: #0f172a;">
          <p class="muted" style="margin: 0; line-height: 1.4;">
            {{ t('workspace.scheduleInterval', { n: overview.intervalMinutes }) }} · {{ t('workspace.sidebarFooterScheduled') }}
          </p>
        </div>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
.worker-badge-btn {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid currentColor;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.worker-badge-btn:hover {
  filter: brightness(1.2);
  transform: scale(1.02);
}
.multi-provider-badge {
  font-size: 10px;
  color: #38bdf8;
  background: #0c4a6e33;
  border: 1px solid #0284c744;
  padding: 1px 6px;
  border-radius: 4px;
}
.provider-recap-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.provider-recap-chip {
  font-size: 10px;
  color: #94a3b8;
}
.provider-recap-chip strong {
  color: #e2e8f0;
}
.worker-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.worker-info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: var(--bg-hover, #141f33);
  border: 1px solid var(--border-color, #263349);
  border-radius: 6px;
  padding: 8px 10px;
}
.action-icon-btn.copy-link-btn.copied {
  color: var(--success-color, #4ade80);
  border-color: var(--success-color, #4ade80);
}
.copy-success-icon {
  color: var(--success-color, #4ade80);
}
.tiny {
  font-size: 10px;
}
.time-btn {
  background: none;
  border: none;
  color: #38bdf8;
  padding: 0;
  font: inherit;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.time-btn:hover {
  color: #7dd3fc;
}
.error-pill {
  display: inline-block;
  background: #7f1d1d44;
  color: #fca5a5;
  border: 1px solid #ef444455;
  border-radius: 4px;
  padding: 1px 6px;
  font-size: 10px;
  font-family: ui-monospace, monospace;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.error-diag-card {
  margin-top: 12px;
  background: #450a0a2a;
  border: 1px solid #ef444455;
  border-radius: 6px;
  padding: 10px 12px;
}
.error-message-text {
  margin: 6px 0 0;
  font-size: 11px;
  color: #fca5a5;
  font-family: ui-monospace, monospace;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.compact-provider-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  padding: 4px 0;
  border-bottom: 1px solid #263349;
}
.compact-provider-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #141f33;
  border: 1px solid #263349;
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 11px;
}
.compact-stats {
  display: inline-flex;
  gap: 8px;
  color: #94a3b8;
  font-size: 10px;
}
.compact-stats strong {
  color: #e2e8f0;
}
.action-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #7dd3fc;
  background: #141f33;
  border: 1px solid #263349;
  padding: 3px 6px;
  border-radius: 5px;
  transition: all 0.15s;
  cursor: pointer;
}
.action-icon-btn:hover {
  background: #1e293b;
  color: #38bdf8;
  border-color: #38bdf8;
}
.worker-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  margin-right: 5px;
}
.worker-dot.pulsing {
  box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
  animation: pulse-green 1.8s infinite;
}
@keyframes pulse-green {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 6px rgba(74, 222, 128, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(74, 222, 128, 0);
  }
}
.model-item.list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  min-height: 44px;
  max-height: 44px;
  padding: 0 10px;
  margin-bottom: 3px;
  border-radius: 5px;
  background: transparent;
  border: 1px solid transparent;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}
.model-item.list:hover {
  background: #141e2e;
}
.model-item.list[aria-pressed="true"] {
  background: #173148;
  border-color: #316180;
}
.list-item-names {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.model-title-text {
  font-size: 12px;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.canonical-subtext {
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ttft-badge {
  font-size: 10px;
  color: #94a3b8;
  background: #0f172a;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid #1e293b;
  white-space: nowrap;
}
.model-item.cards {
  background: #141e2e;
  border: 1px solid #263349;
  padding: 12px;
  margin-bottom: 8px;
  border-radius: 6px;
  display: block;
  text-align: left;
  width: 100%;
}
.model-item.cards[aria-pressed="true"] {
  border-color: #38bdf8;
  background: #173148;
}
.sort-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sort-field select {
  padding: 5px 8px;
  font-size: 11px;
}
.workspace {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #0b101a;
}
.workspace-header {
  height: 54px;
  flex-shrink: 0;
  padding: 0 18px;
  border-bottom: 1px solid #263349;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  color: #e5edf8;
  font-size: 19px;
  letter-spacing: -0.5px;
}
.brand svg {
  color: #38bdf8;
}
.workspace-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.model-sidebar {
  width: var(--sidebar-width);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #0f1724;
}
.selector-controls {
  padding: 12px 14px;
  gap: 8px;
  border-bottom: 1px solid #263349;
}
.search-box {
  position: relative;
}
.search-box svg {
  position: absolute;
  top: 10px;
  left: 9px;
  color: #91a2bb;
}
.search-box input {
  padding-left: 30px;
}
.filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.model-list {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding: 6px;
}
.canonical-name {
  display: block;
  font-size: 11px;
  margin: 3px 0 6px;
  overflow-wrap: anywhere;
}
.model-providers {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.provider-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
}
.sidebar-footer {
  padding: 10px 14px;
  border-top: 1px solid #263349;
  line-height: 1.5;
}
.resize-handle {
  width: 5px;
  flex-shrink: 0;
  cursor: col-resize;
  border-left: 1px solid #263349;
  touch-action: none;
}
.resize-handle:hover,
.resize-handle:focus {
  background: #38bdf8;
}
.model-detail {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}
.model-detail > * {
  flex-shrink: 0;
}
.detail-heading {
  flex-shrink: 0;
  display: grid;
  gap: 6px;
}
.eyebrow {
  font-size: 10px;
  color: #7dd3fc;
  letter-spacing: 1.2px;
  margin-bottom: 2px;
}
.range-controls {
  display: flex;
  gap: 8px;
}
.range-controls > label {
  min-width: 130px;
}
.custom-range {
  align-items: end;
}
.custom-range label {
  flex: 1;
}
.chart-card {
  height: auto;
  min-height: 0;
  flex: none;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}
.primary-chart {
  width: 100%;
  height: 350px;
  min-height: 350px;
  position: relative;
}
.chart-card-header {
  align-items: center;
  gap: 8px;
}
.provider-overlays {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  overflow-y: auto;
  flex-shrink: 0;
}
.provider-comparison-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 7px;
  border: 1px solid var(--border-color, #334155);
  border-radius: 999px;
  background: var(--bg-input, #0f1724);
  white-space: nowrap;
  font-size: 11px;
}
.provider-comparison-chip:has(input:checked) {
  border-color: var(--accent-color, #38bdf8);
  background: var(--bg-active, #173148);
}
.chart-empty {
  position: absolute;
  inset: 40% 0 auto;
  text-align: center;
  pointer-events: none;
}
.history-panel {
  flex: none;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.timeline-heading, .comparison-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.timeline-heading .status-legend { justify-content: flex-end; }
.status-legend {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.provider-history {
  padding: 12px;
}
.provider-metrics {
  display: flex;
  gap: 12px 20px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.provider-metrics > div {
  display: grid;
  gap: 2px;
}
.provider-metrics span {
  font-size: 10px;
  color: #91a2bb;
}
.provider-metrics strong {
  font-size: 12px;
}
.history-blocks-wrapper {
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 2px;
}
.table-scroll {
  overflow-x: auto;
  max-height: 320px;
}
.sample-record {
  border-top: 1px solid var(--border-color, #263349);
  padding-top: 14px;
  margin-top: 14px;
}
.mobile-only {
  display: none;
}
.drawer-backdrop {
  display: none;
}
summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--text-muted, #b8c8df);
}
.sample-details {
  padding: 12px;
}

@media (max-width: 900px) {
  .view-mode-controls {
    display: none;
  }
  .model-detail {
    padding: 12px;
    gap: 10px;
  }
  .model-sidebar {
    width: 240px;
  }
  .resize-handle {
    display: none;
  }
}

@media (max-width: 768px) {
  .desktop-only {
    display: none;
  }
  .mobile-only {
    display: inline-flex;
  }
  .workspace-header {
    height: 50px;
    padding: 0 10px;
  }
  .header-actions {
    gap: 6px !important;
  }
  .model-sidebar {
    display: none;
    position: fixed;
    inset: 0 auto 0 0;
    width: min(320px, 85vw);
    z-index: 30;
  }
  .model-sidebar.drawer-open {
    display: flex;
  }
  .drawer-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 25;
    background: rgba(2, 6, 23, 0.75);
  }
  .detail-heading h1 {
    font-size: 18px;
  }
  .range-controls {
    width: 100%;
  }
  .range-controls > label {
    width: 100%;
    min-width: 0;
  }
  .range-controls select {
    width: 100%;
  }
  .chart-card {
    padding: 12px;
    gap: 10px;
    height: auto;
    min-height: 0;
  }
  .chart-card-header {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  .samples-info-text {
    font-size: 11px;
    text-align: right;
  }
  .primary-chart {
    height: 250px;
    min-height: 250px;
  }
  .history-panel {
    padding-bottom: calc(32px + env(safe-area-inset-bottom, 0px));
  }
  .provider-history > .row.spread {
    align-items: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
