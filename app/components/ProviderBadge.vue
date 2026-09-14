<script setup lang="ts">
const props = withDefaults(defineProps<{
  providerId: number | string
  name: string
  iconUrl?: string | null
  size?: number
}>(), {
  iconUrl: null,
  size: 16
})

const providerColors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#2dd4bf', '#818cf8', '#60a5fa', '#fb7185']

const color = computed(() => {
  const num = typeof props.providerId === 'number' ? props.providerId : Array.from(String(props.providerId)).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return providerColors[(Math.abs(num) - 1) % providerColors.length] || providerColors[0]
})

const initial = computed(() => {
  return props.name?.trim().charAt(0).toUpperCase() || 'P'
})
</script>

<template>
  <span
    class="provider-badge"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      minWidth: `${size}px`,
      minHeight: `${size}px`,
      fontSize: `${Math.max(9, Math.floor(size * 0.65))}px`
    }"
    :title="name"
  >
    <img v-if="iconUrl" :src="iconUrl" :alt="name" class="provider-img" />
    <span v-else class="provider-initial" :style="{ backgroundColor: color }">
      {{ initial }}
    </span>
  </span>
</template>

<style scoped>
.provider-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  vertical-align: middle;
}
.provider-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 50%;
}
.provider-initial {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: #0b101a;
  border-radius: 50%;
  user-select: none;
  line-height: 1;
}
</style>
