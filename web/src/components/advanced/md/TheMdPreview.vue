<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div
    ref="rootRef"
    class="echo-md-preview"
    :class="{
      'is-collapsible': props.collapsible,
      'is-clamped': isClamped,
      'is-expanded': props.collapsible && isExpanded,
    }"
    :style="{ '--clamp-height': `${props.maxHeight}px` }"
  >
    <div ref="bodyRef" class="echo-md-preview-body">
      <div ref="measureRef" class="echo-md-preview-measure">
        <MarkdownRenderer :content="props.content" />
      </div>
    </div>

    <!-- Collapsed Fade Overlay & Action Buttons -->
    <div v-if="isClamped" class="echo-md-fade-overlay">
      <div class="echo-md-actions">
        <button
          type="button"
          class="echo-md-btn echo-md-btn--expand"
          :aria-label="t('echoCard.expand')"
          @click.stop="toggleExpand"
        >
          <span>{{ t('echoCard.expand') }}</span>
          <ChevronDown class="w-3.5 h-3.5" />
        </button>

        <button
          v-if="hasDetailAction"
          type="button"
          class="echo-md-btn echo-md-btn--detail"
          :aria-label="t('echoCard.openDetail')"
          @click.stop="handleOpenDetail"
        >
          <span>{{ t('echoCard.openDetail') }}</span>
          <Linkto class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Expanded Footer Controls -->
    <div
      v-else-if="props.collapsible && isOverflow && isExpanded"
      class="echo-md-actions--expanded"
    >
      <button
        type="button"
        class="echo-md-link-btn"
        :aria-label="t('echoCard.collapse')"
        @click.stop="handleCollapse"
      >
        <span>{{ t('echoCard.collapse') }}</span>
        <ChevronUp class="w-3.5 h-3.5" />
      </button>

      <button
        v-if="hasDetailAction"
        type="button"
        class="echo-md-link-btn"
        :aria-label="t('echoCard.openDetail')"
        @click.stop="handleOpenDetail"
      >
        <span>{{ t('echoCard.openDetail') }}</span>
        <Linkto class="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useAttrs } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { MarkdownRenderer } from '@/editor/preview'
import ChevronDown from '@/components/icons/chevrondown.vue'
import ChevronUp from '@/components/icons/chevronup.vue'
import Linkto from '@/components/icons/linkto.vue'

const props = withDefaults(
  defineProps<{
    content: string
    collapsible?: boolean
    maxHeight?: number
    threshold?: number
    echoId?: string | number
    showDetailAction?: boolean
  }>(),
  {
    collapsible: false,
    maxHeight: 250,
    showDetailAction: true,
  },
)

const emit = defineEmits<{
  (e: 'openDetail'): void
  (e: 'update:expanded', value: boolean): void
}>()

const attrs = useAttrs()
const router = useRouter()
const { t } = useI18n()

const rootRef = ref<HTMLElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)

const contentHeight = ref(0)
const isExpanded = ref(false)

const computedThreshold = computed(() => {
  return props.threshold ?? props.maxHeight + 60
})

const isOverflow = computed(() => {
  if (!props.collapsible) return false
  return contentHeight.value > computedThreshold.value
})

const isClamped = computed(() => {
  return props.collapsible && isOverflow.value && !isExpanded.value
})

const hasDetailAction = computed(() => {
  return props.showDetailAction && (Boolean(props.echoId) || Boolean(attrs.onOpenDetail))
})

const updateMeasuredHeight = () => {
  if (measureRef.value) {
    contentHeight.value = Math.round(measureRef.value.offsetHeight)
  }
}

useResizeObserver(measureRef, (entries) => {
  const entry = entries[0]
  if (entry) {
    const height = entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height
    contentHeight.value = Math.round(height || measureRef.value?.offsetHeight || 0)
  }
})

onMounted(() => {
  updateMeasuredHeight()
})

const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
  emit('update:expanded', isExpanded.value)
}

const handleCollapse = () => {
  isExpanded.value = false
  emit('update:expanded', false)
  if (rootRef.value) {
    const rect = rootRef.value.getBoundingClientRect()
    if (rect.top < 80) {
      rootRef.value.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }
}

const handleOpenDetail = () => {
  emit('openDetail')
  if (props.echoId) {
    router.push({
      name: 'echo',
      params: { echoId: String(props.echoId) },
    })
  }
}
</script>

<style scoped lang="css">
.echo-md-preview {
  position: relative;
  width: 100%;
}

.echo-md-preview-body {
  position: relative;
  width: 100%;
  transition: max-height 0.28s cubic-bezier(0.2, 0, 0, 1);
}

.echo-md-preview.is-clamped .echo-md-preview-body {
  max-height: var(--clamp-height, 250px);
  overflow: hidden;
  mask-image: linear-gradient(to bottom, black calc(100% - 4.5rem), transparent 100%);
}

.echo-md-preview.is-expanded .echo-md-preview-body {
  max-height: none;
  overflow: visible;
  mask-image: none;
}

.echo-md-fade-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 5.5rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 0.2rem;
  pointer-events: none;
}

.echo-md-actions {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem;
}

.echo-md-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  background: var(--color-bg-surface);
  color: var(--color-accent);
  border: 1px solid var(--color-border-subtle);
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.1s ease;
  user-select: none;
}

.echo-md-btn:hover {
  background: var(--color-bg-muted);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
  box-shadow: var(--shadow-md);
}

.echo-md-btn:active {
  transform: scale(0.97);
}

.echo-md-btn--detail {
  color: var(--color-text-secondary);
}

.echo-md-actions--expanded {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 0.5rem;
  margin-top: 0.35rem;
  border-top: 1px dashed var(--color-border-subtle);
}

.echo-md-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
  color: var(--color-text-muted);
  cursor: pointer;
  background: transparent;
  border: none;
  padding: 0.25rem 0.4rem;
  border-radius: var(--radius-sm);
  transition: color 0.15s ease;
  user-select: none;
}

.echo-md-link-btn:hover {
  color: var(--color-accent);
}
</style>
