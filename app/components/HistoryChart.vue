<script setup lang="ts">
import { Chart, LineController, LineElement, PointElement, LinearScale, Tooltip, Legend } from 'chart.js'
import type { HistoryPoint, ProviderHistory } from '../../shared/types'
Chart.register(LineController, LineElement, PointElement, LinearScale, Tooltip, Legend)
const props = defineProps<{ series: ProviderHistory[]; metric: 'ttftMs' | 'totalMs' | 'ratePerSec'; from: number; to: number; intervalMinutes: number }>()
const emit = defineEmits<{ sample: [point: HistoryPoint, providerName: string] }>()
const { locale, t } = useI18n()
const canvas = ref<HTMLCanvasElement | null>(null)
type ChartPoint = { x: number; y: number | null; sample?: HistoryPoint }
let chart: Chart<'line', ChartPoint[]> | null = null
const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#facc15', '#2dd4bf', '#818cf8', '#60a5fa', '#fb7185']
function getProviderColor(id: number | string) {
  const num = typeof id === 'number' ? id : Array.from(String(id)).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return colors[(Math.abs(num) - 1) % colors.length] || colors[0]
}
function render() {
  if (!canvas.value) return
  chart?.destroy()
  const loc = locale.value === 'id' ? 'id-ID' : 'en-US'
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
      interaction: { mode: 'nearest', intersect: false },
      onClick: (_event, elements) => {
        const element = elements[0]
        if (!element) return
        const point = datasets[element.datasetIndex]?.data[element.index]
        const provider = props.series[element.datasetIndex]?.provider.name
        if (point?.sample && provider) emit('sample', point.sample, provider)
      },
      plugins: {
        legend: { display: true, labels: { color: '#aebed4', boxWidth: 10, boxHeight: 10, usePointStyle: true } },
        tooltip: {
          callbacks: {
            title: items => items[0]?.parsed.x != null ? new Date(items[0].parsed.x).toLocaleString(loc) : '',
            label: item => `${item.dataset.label}: ${item.parsed.y?.toLocaleString(loc, { maximumFractionDigits: 2 }) ?? t('workspace.noMeasurementsYet')} ${props.metric === 'ratePerSec' ? 'tok/s' : 'ms'}`
          }
        },
      },
      scales: {
        x: { type: 'linear', min: props.from, max: props.to, grid: { color: '#26334966' }, ticks: { color: '#91a2bb', maxTicksLimit: 7, callback: value => new Date(Number(value)).toLocaleString(loc, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } },
        y: { beginAtZero: true, title: { display: true, text: props.metric === 'ratePerSec' ? 'tokens / second' : 'milliseconds', color: '#91a2bb' }, ticks: { color: '#91a2bb' }, grid: { color: '#26334966' } },
      },
    },
  })
}
watch(() => [props.series, props.metric, props.from, props.to, props.intervalMinutes, locale.value], render)
onMounted(render)
onUnmounted(() => chart?.destroy())
</script>
<template>
  <div class="chart-surface"><canvas ref="canvas" role="img" :aria-label="`${metric === 'ttftMs' ? 'Time to first token' : metric === 'totalMs' ? 'Total latency' : 'Throughput'} by provider. Missing intervals are gaps. Open the samples table for accessible values.`" /></div>
</template>
<style scoped>.chart-surface{position:relative;min-height:0;width:100%;height:100%}</style>
