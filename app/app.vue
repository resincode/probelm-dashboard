<script setup lang="ts">
import './assets/main.css'
const { t } = useI18n()
const { theme } = useTheme()
useHead(() => ({
  title: 'Probelm · ' + t('common.tagline'),
  meta: [{ name: 'description', content: t('workspace.sidebarFooterScheduled') }],
  link: [{ rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }, { rel: 'shortcut icon', href: '/icon.svg' }],
  htmlAttrs: {
    class: theme.value,
    'data-theme': theme.value
  }
}))
</script>
<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
