<script setup lang="ts">
import { Globe } from 'lucide-vue-next'
const { locale, setLocale, t } = useI18n()
</script>

<template>
  <div class="lang-switcher row" :aria-label="t('common.language')">
    <Globe :size="14" class="globe-icon desktop-only" />
    <button
      type="button"
      class="lang-btn"
      :class="{ active: locale === 'en' }"
      aria-label="English"
      :aria-pressed="locale === 'en'"
      @click="setLocale('en')"
    >
      EN
    </button>
    <span class="divider">/</span>
    <button
      type="button"
      class="lang-btn"
      :class="{ active: locale === 'id' }"
      aria-label="Bahasa Indonesia"
      :aria-pressed="locale === 'id'"
      @click="setLocale('id')"
    >
      ID
    </button>
  </div>
</template>

<style scoped>
.lang-switcher {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-input, #131c2e);
  border: 1px solid var(--border-color, #263349);
  border-radius: 6px;
  padding: 3px 6px;
  font-size: 11px;
  flex-shrink: 0;
}
.globe-icon {
  color: #70849f;
  margin-right: 2px;
}
.lang-btn {
  background: none;
  border: none;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #8fa0b8;
  cursor: pointer;
  border-radius: 3px;
  line-height: 1;
}
.lang-btn:hover {
  color: #e5edf8;
}
.lang-btn.active {
  color: var(--accent-color, #38bdf8);
  background: var(--bg-hover, #1e293b);
}
.divider {
  color: #334155;
  font-size: 10px;
  user-select: none;
}
</style>
