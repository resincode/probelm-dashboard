<script setup lang="ts">
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from 'chart.js'
import type { HistoryPoint, ProviderHistory } from '../../shared/types'
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend)
const props = defineProps<{ series: ProviderHistory[]; metric: 'ttftMs' | 'totalMs' | 'ratePerSec'; from: number; to: number; intervalMinutes: number }>()
const emit = defineEmits<{ sample: [point: HistoryPoint, providerName: string] }>()
const { locale, t } = useI18n()
const { theme } = useTheme()
const canvas = ref<HTMLCanvasElement | null>(null)
type ChartPoint = { x: number; y: number | null; sample?: HistoryPoint }
let chart: Chart<'line', ChartPoint[]> | null = null
let resizeObserver: ResizeObserver | undefined
let resizeFrame: number | undefined
let lastWidth = 0
let lastHeight = 0
const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#2dd4bf', '#818cf8', '#60a5fa', '#fb7185']
function getProviderColor(id: number | string) {
  const num = typeof id === 'number' ? id : Array.from(String(id)).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[(Math.abs(num) - 1) % colors.length] || colors[0]
}
function scheduleRender() {
  if (!import.meta.client) return
  if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = undefined
    const parent = canvas.value?.parentElement
    if (!parent) return
    const width = parent.clientWidth
    const height = parent.clientHeight
    if (Math.abs(width - lastWidth) < 1 && Math.abs(height - lastHeight) < 1) return
    render()
  })
}
function render() {
  if (!canvas.value) return
  const parent = canvas.value.parentElement
  if (parent) { lastWidth = parent.clientWidth; lastHeight = parent.clientHeight }
  chart?.destroy()
  const loc = locale.value === 'id' ? 'id-ID' : 'en-US'
  const isLight = theme.value === 'light'
  const compact = import.meta.client && window.innerWidth <= 640
  const gridColor = isLight ? '#e2e8f0' : '#26334966'
  const textColor = isLight ? '#64748b' : '#91a2bb'
  const legendColor = isLight ? '#334155' : '#aebed4'
  const datasets = props.series.map((series) => {
    const points: ChartPoint[] = []
    let previous: HistoryPoint | undefined
    for (const point of series.points) {
      const interval = (point.intervalMinutes ?? previous?.intervalMinutes ?? props.intervalMinutes) * 60000
      if (previous && point.ts - previous.ts > interval * 1.5) points.push({ x: previous.ts + interval, y: null })
      points.push({ x: point.ts, y: point.status === 'up' || point.status === 'slow' ? point[props.metric] : null, sample: point })
      previous = point
    }
    const color = getProviderColor(series.provider.id)
    return { label: series.provider.name, data: points, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: points.length > 150 ? 1 : 2.5, pointHoverRadius: 5, tension: 0, spanGaps: false }
  })
  chart = new Chart<'line', ChartPoint[]>(canvas.value, {
    type: 'line', data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false, normalized: false,
      layout: { padding: compact ? { top: 6, right: 6, bottom: 4, left: 2 } : { top: 6, right: 12, bottom: 6, left: 6 } },
      interaction: { mode: 'nearest', intersect: false, axis: 'x' },
      onClick: (_event, elements) => {
        const element = elements[0]
        if (!element) return
        const point = datasets[element.datasetIndex]?.data[element.index]
        const provider = props.series[element.datasetIndex]?.provider.name
        if (point?.sample && provider) emit('sample', point.sample, provider)
      },
      plugins: {
        legend: { display: !compact, position: 'top', labels: { color: legendColor, boxWidth: 10, boxHeight: 10, padding: 12, usePointStyle: true, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            title: items => items[0]?.parsed.x != null ? new Date(items[0].parsed.x).toLocaleString(loc) : '',
            label: item => `${item.dataset.label}: ${item.parsed.y?.toLocaleString(loc, { maximumFractionDigits: 2 }) ?? t('workspace.noMeasurementsYet')} ${props.metric === 'ratePerSec' ? 'tok/s' : 'ms'}`
          }
        },
      },
      scales: {
        x: {
          type: 'linear', min: props.from, max: props.to, grid: { color: gridColor },
          ticks: {
            color: textColor, maxTicksLimit: compact ? 3 : 7, maxRotation: 0, autoSkip: true,
            callback: value => new Date(Number(value)).toLocaleString(loc, compact ? { hour: '2-digit', minute: '2-digit' } : { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
          }
        },
        y: {
          beginAtZero: true,
          title: { display: !compact, text: props.metric === 'ratePerSec' ? 'tokens / second' : 'milliseconds', color: textColor },
          ticks: {
            color: textColor, maxTicksLimit: compact ? 5 : 9, precision: 0,
            callback: value => compact ? (Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(1)}k` : value) : `${value}${props.metric === 'ratePerSec' ? ' tok/s' : ' ms'}`
          },
          grid: { color: gridColor }
        },
      },
    },
  })
}
watch(() => [props.series, props.metric, props.from, props.to, props.intervalMinutes, locale.value, theme.value], render)
onMounted(() => {
  render()
  if (canvas.value?.parentElement) {
    resizeObserver = new ResizeObserver(() => scheduleRender())
    resizeObserver.observe(canvas.value.parentElement)
  }
})
onUnmounted(() => { resizeObserver?.disconnect(); chart?.destroy() })
</script>
<template>
  <div class="chart-surface"><canvas ref="canvas" role="img" :aria-label="`${metric === 'ttftMs' ? 'Time to first token' : metric === 'totalMs' ? 'Total latency' : 'Throughput'} by provider. Missing intervals are gaps. Open the samples table for accessible values.`" /></div>
</template>
<style scoped>.chart-surface{position:relative;min-height:0;width:100%;height:100%}</style>
