<script setup lang="ts">
const props = withDefaults(defineProps<{
  canonicalName?: string
  displayName?: string
  iconKey?: string | null
  size?: number
}>(), {
  canonicalName: '',
  displayName: '',
  iconKey: null,
  size: 16
})

const resolvedKey = computed(() => {
  if (props.iconKey && props.iconKey !== 'auto') {
    return props.iconKey.toLowerCase()
  }
  const text = `${props.canonicalName} ${props.displayName}`.toLowerCase()
  if (/\b(gpt|o1|o3|o4|codex|dall-e|chatgpt)\b|openai/.test(text) || text.includes('gpt-')) return 'openai'
  if (/claude|sonnet|haiku|opus|anthropic/.test(text)) return 'anthropic'
  if (/deepseek/.test(text)) return 'deepseek'
  if (/qwen/.test(text)) return 'qwen'
  if (/glm|zhipu|chatglm/.test(text)) return 'glm'
  if (/kimi|moonshot/.test(text)) return 'kimi'
  if (/gemini|gemma|palm|google/.test(text)) return 'google'
  if (/llama|meta/.test(text)) return 'meta'
  if (/mimo|xiaomi/.test(text)) return 'mimo'
  if (/mistral|mixtral|codestral/.test(text)) return 'mistral'
  if (/minimax/.test(text)) return 'minimax'
  return 'default'
})
</script>

<template>
  <span class="model-logo-wrapper" :style="{ width: `${size}px`, height: `${size}px` }" :title="resolvedKey">
    <!-- OpenAI -->
    <svg v-if="resolvedKey === 'openai'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg openai">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 10.74l2.943-1.7 2.943 1.7v3.398l-2.943 1.7-2.943-1.7z" />
    </svg>

    <!-- Anthropic -->
    <svg v-else-if="resolvedKey === 'anthropic'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg anthropic">
      <path d="M17.472 3.637h-3.965L20.89 20.363h3.11zm-10.944 0L0 20.363h3.586l1.458-3.414h6.052l1.458 3.414h3.586L9.613 3.637zm-.437 10.596l1.895-4.434 1.895 4.434z" />
    </svg>

    <!-- DeepSeek -->
    <svg v-else-if="resolvedKey === 'deepseek'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg deepseek">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 3.344 1.642 6.302 4.167 8.102.268.192.628.167.868-.06.23-.217.272-.572.095-.838A8.956 8.956 0 0 1 5 13.5c0-4.97 4.03-9 9-9 3.033 0 5.71 1.5 7.33 3.8.193.274.57.34.842.152.274-.188.347-.56.16-.838A9.957 9.957 0 0 0 14 3.73V2.5a.5.5 0 0 0-1 0v1.23A9.97 9.97 0 0 0 12 2zm3.5 6c-2.485 0-4.5 2.015-4.5 4.5 0 1.346.593 2.553 1.533 3.377a.5.5 0 0 0 .664-.748A3.487 3.487 0 0 1 12 12.5c0-1.933 1.567-3.5 3.5-3.5 1.487 0 2.766.928 3.275 2.242.185.478.718.72 1.196.536.478-.184.72-.718.536-1.196A4.49 4.49 0 0 0 15.5 8zM12 18a.5.5 0 0 0-.5.5v3a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-.5-.5z" />
    </svg>

    <!-- Qwen / Alibaba -->
    <svg v-else-if="resolvedKey === 'qwen'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg qwen">
      <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zm0 2.236L18.764 8 12 11.764 5.236 8 12 4.236zM4.5 8.944L11 12.556v7.108L4.5 16.056V8.944zm15 7.112L13 19.664v-7.108l6.5-3.612v7.112z" />
    </svg>

    <!-- GLM / Zhipu -->
    <svg v-else-if="resolvedKey === 'glm'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg glm">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V15h-2v1.93A8 8 0 0 1 4.07 13H6v-2H4.07A8 8 0 0 1 11 4.07V6h2V4.07A8 8 0 0 1 19.93 11H18v2h1.93A8 8 0 0 1 13 16.93zM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4z" />
    </svg>

    <!-- Moonshot / Kimi -->
    <svg v-else-if="resolvedKey === 'kimi'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg kimi">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>

    <!-- Google / Gemini / Gemma -->
    <svg v-else-if="resolvedKey === 'google'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg google">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>

    <!-- Meta / Llama -->
    <svg v-else-if="resolvedKey === 'meta'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg meta">
      <path d="M16.96 4C14.34 4 12.78 5.6 12 6.54 11.22 5.6 9.66 4 7.04 4 3.3 4 0 7.3 0 11.53c0 4.23 3.3 8.47 7.04 8.47 2.62 0 4.18-1.6 4.96-2.54.78.94 2.34 2.54 4.96 2.54 3.74 0 7.04-4.24 7.04-8.47C24 7.3 20.7 4 16.96 4zm0 13.55c-2.3 0-3.8-1.9-4.96-3.48 1.16-1.58 2.66-3.48 4.96-3.48 2.2 0 4.4 2.2 4.4 4.96 0 2.76-2.2 4.96-4.4 4.96zM7.04 17.55c-2.2 0-4.4-2.2-4.4-4.96 0-2.76 2.2-4.96 4.4-4.96 2.3 0 3.8 1.9 4.96 3.48-1.16 1.58-2.66 3.48-4.96 3.48z" />
    </svg>

    <!-- Xiaomi / Mimo -->
    <svg v-else-if="resolvedKey === 'mimo'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg mimo">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
    </svg>

    <!-- Mistral -->
    <svg v-else-if="resolvedKey === 'mistral'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg mistral">
      <path d="M2 4h4v4H2zm7 0h4v4H9zm7 0h4v4h-4zM2 11h4v4H2zm7 0h4v4H9zm7 0h4v4h-4zM2 18h4v4H2zm7 0h4v4H9zm7 0h4v4h-4z" />
    </svg>

    <!-- MiniMax -->
    <svg v-else-if="resolvedKey === 'minimax'" viewBox="0 0 24 24" fill="currentColor" class="brand-svg minimax">
      <path d="M3 3h4v18H3zm7 5h4v13h-4zm7-3h4v16h-4z" />
    </svg>

    <!-- Default Model Brain / Cube -->
    <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="brand-svg default">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  </span>
</template>

<style scoped>
.model-logo-wrapper {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: middle;
}
.brand-svg {
  width: 100%;
  height: 100%;
  transition: transform 0.15s;
}
.brand-svg.openai { color: #10a37f; }
.brand-svg.anthropic { color: #d97706; }
.brand-svg.deepseek { color: #3b82f6; }
.brand-svg.qwen { color: #8b5cf6; }
.brand-svg.glm { color: #06b6d4; }
.brand-svg.kimi { color: #ec4899; }
.brand-svg.google { color: #f59e0b; }
.brand-svg.meta { color: #0284c7; }
.brand-svg.mimo { color: #f97316; }
.brand-svg.mistral { color: #f43f5e; }
.brand-svg.minimax { color: #6366f1; }
.brand-svg.default { color: #94a3b8; }
</style>
