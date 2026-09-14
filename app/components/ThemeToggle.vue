<script setup lang="ts">
import { Sun, Moon } from 'lucide-vue-next'
const { theme, toggleTheme } = useTheme()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="icon-button theme-toggle-btn"
    :title="theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')"
    :aria-label="theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')"
    @click="toggleTheme"
  >
    <Sun v-if="theme === 'dark'" :size="15" class="sun-icon" />
    <Moon v-else :size="15" class="moon-icon" />
  </button>
</template>

<style scoped>
.theme-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #91a2bb);
  transition: color 0.15s, background 0.15s;
}
.theme-toggle-btn:hover {
  color: var(--text-color, #e5edf8);
}
.sun-icon {
  color: #facc15;
}
.moon-icon {
  color: #38bdf8;
}
</style>
