<script setup lang="ts">
import './assets/main.css'
const { t } = useI18n()
useHead(() => ({
  title: 'Probelm · ' + t('common.tagline'),
  meta: [{ name: 'description', content: t('workspace.sidebarFooterScheduled') }]
}))
</script>
<template>
  <NuxtRouteAnnouncer />
  <NuxtPage />
</template>
