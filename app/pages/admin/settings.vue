<script setup lang="ts">
import type { MonitoringSettings, MonitoringState } from '../../../shared/types'
definePageMeta({ middleware: 'admin' })
const { auth, request, changePassword } = useAdminSession()
const { t, formatDate, formatRelativeTime, setDateFormat } = useI18n()
const state = ref<MonitoringState | null>(null)
const settings = ref<MonitoringSettings | null>(null)
const error = ref('')
const notice = ref('')
const busy = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmation = ref('')
let timer: ReturnType<typeof setInterval> | undefined
async function load(replaceForm = true) {
  if (auth.value.user?.mustChangePassword) return
  try {
    state.value = await request<MonitoringState>('/api/admin/settings/monitoring')
    if (state.value.settings.dateFormat) setDateFormat(state.value.settings.dateFormat)
    if (replaceForm) settings.value = { ...state.value.settings, dateFormat: state.value.settings.dateFormat || 'DD/MM/YYYY' }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not load settings' }
}
async function saveSettings() {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    state.value = await request<MonitoringState>('/api/admin/settings/monitoring', 'PUT', settings.value)
    if (state.value.settings.dateFormat) setDateFormat(state.value.settings.dateFormat)
    settings.value = { ...state.value.settings, dateFormat: state.value.settings.dateFormat || 'DD/MM/YYYY' }
    notice.value = t('settings.settingsSaved')
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not save settings' }
  finally { busy.value = false }
}
async function savePassword() {
  error.value = ''; notice.value = ''
  if (newPassword.value !== confirmation.value) { error.value = t('settings.passwordsDoNotMatch'); return }
  busy.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''; newPassword.value = ''; confirmation.value = ''
    notice.value = t('settings.passwordChanged')
    await load()
  }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Could not change password' }
  finally { busy.value = false }
}
onMounted(async () => { await load(); timer = setInterval(() => load(false), 30000) })
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>
<template>
  <AdminShell>
    <h1>{{ t('settings.title') }}</h1>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="notice" class="success" role="status">{{ notice }}</p>
    <section v-if="!auth.user?.mustChangePassword" class="stack">
      <div v-if="state" class="panel row spread" style="align-items: flex-start;">
        <div>
          <h2>{{ t('settings.externalWorker') }}</h2>
          <span :class="state.worker.online ? 'success' : 'danger'">{{ state.worker.online ? t('settings.heartbeatHealthy') : t('settings.workerOfflineStale') }}</span>
        </div>
        <div class="small">
          {{ t('settings.lastHeartbeat') }}<br />
          <strong>{{ formatRelativeTime(state.worker.heartbeatAt, t('common.never')) }}</strong>
          <div v-if="state.worker.heartbeatAt" class="muted" style="font-size:10px;margin-top:2px">{{ formatDate(state.worker.heartbeatAt) }}</div>
        </div>
        <div class="small">
          {{ t('settings.lastRun') }}<br />
          <strong>{{ formatRelativeTime(state.worker.lastRunAt, t('common.never')) }}</strong>
          <div v-if="state.worker.lastRunAt" class="muted" style="font-size:10px;margin-top:2px">{{ formatDate(state.worker.lastRunAt) }}</div>
        </div>
        <div class="small">
          {{ t('settings.nextRun') }}<br />
          <strong>{{ formatRelativeTime(state.worker.nextRunAt, t('common.notScheduled')) }}</strong>
          <div v-if="state.worker.nextRunAt" class="muted" style="font-size:10px;margin-top:2px">{{ formatDate(state.worker.nextRunAt) }}</div>
        </div>
        <span class="badge">{{ state.worker.activeRunId ? t('common.running', { n: state.worker.activeRunId }) : t('common.idle') }}</span>
      </div>
      <form v-if="settings" class="panel stack" @submit.prevent="saveSettings">
        <div class="row spread">
          <h2>{{ t('settings.monitoringScheduleTitle') }}</h2>
          <label class="check"><input v-model="settings.enabled" type="checkbox" /> {{ t('settings.monitoringEnabled') }}</label>
        </div>
        <p class="muted small">{{ t('settings.monitoringDescription') }}</p>
        <div class="field-grid">
          <label>{{ t('settings.intervalMinutes') }}<input v-model.number="settings.intervalMinutes" type="number" min="1" max="1440" required /></label>
          <label>{{ t('settings.dateFormatLabel') }}
            <select v-model="settings.dateFormat">
              <option value="DD/MM/YYYY">DD/MM/YYYY (15/09/2026)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-09-15)</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (09/15/2026)</option>
            </select>
          </label>
          <label>{{ t('settings.requestTimeoutSeconds') }}<input v-model.number="settings.timeoutSeconds" type="number" min="1" max="300" required /></label>
          <label>{{ t('settings.maxOutputTokens') }}<input v-model.number="settings.maxTokens" type="number" min="1" max="4096" required /></label>
          <label>{{ t('settings.temperature') }}<input v-model.number="settings.temperature" type="number" min="0" max="2" step="0.01" required /></label>
          <label>{{ t('settings.concurrency') }}<input v-model.number="settings.concurrency" type="number" min="1" max="16" required /></label>
          <label>{{ t('settings.slowTtftThreshold') }}<input v-model.number="settings.slowThresholdMs" type="number" min="1" max="300000" required /></label>
          <label class="full">{{ t('settings.probePrompt') }}<textarea v-model="settings.prompt" rows="3" maxlength="4000" required /></label>
        </div>
        <div><button class="primary" :disabled="busy">{{ busy ? t('common.saving') : t('settings.saveMonitoringSettings') }}</button></div>
      </form>
      <p v-else-if="!error" class="empty" role="status">{{ t('settings.loadingSettings') }}</p>
      <button v-else @click="load()">{{ t('settings.retryLoading') }}</button>
    </section>
    <form class="panel stack" @submit.prevent="savePassword">
      <h2>{{ auth.user?.mustChangePassword ? t('settings.requiredResetTitle') : t('settings.changePasswordTitle') }}</h2>
      <p class="muted small">{{ t('settings.passwordGuidance') }}</p>
      <div class="field-grid">
        <label class="full">{{ t('settings.currentPassword') }}<input v-model="currentPassword" type="password" autocomplete="current-password" required /></label>
        <label>{{ t('settings.newPassword') }}<input v-model="newPassword" type="password" autocomplete="new-password" minlength="12" required /></label>
        <label>{{ t('settings.confirmNewPassword') }}<input v-model="confirmation" type="password" autocomplete="new-password" minlength="12" required /></label>
      </div>
      <div><button class="primary" :disabled="busy">{{ t('settings.changePasswordBtn') }}</button></div>
    </form>
  </AdminShell>
</template>
