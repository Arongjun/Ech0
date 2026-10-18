<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div
    class="inline-flex items-center rounded-full ring-1 ring-inset ring-[var(--color-border-subtle)] bg-[var(--input-bg-color)] overflow-hidden"
  >
    <button
      v-if="editing"
      type="button"
      v-tooltip="applyTooltip"
      :aria-label="applyTooltip"
      aria-keyshortcuts="Control+S Meta+S"
      class="w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors duration-200"
      @click="$emit('apply')"
    >
      <Saveupdate class="w-4 h-4" />
    </button>
    <button
      type="button"
      v-tooltip="editing ? cancelTitle : editTitle"
      :aria-label="editing ? cancelTitle : editTitle"
      class="w-7 h-7 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-colors duration-200"
      @click="handleSecondaryClick"
    >
      <Close v-if="editing" class="w-4 h-4" />
      <Edit v-else class="w-4 h-4" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import Edit from '@/components/icons/edit.vue'
import Close from '@/components/icons/close.vue'
import Saveupdate from '@/components/icons/saveupdate.vue'

const props = withDefaults(
  defineProps<{
    editing: boolean
    editTitle?: string
    cancelTitle?: string
    applyTitle?: string
    saveShortcut?: boolean
  }>(),
  {
    editTitle: '编辑',
    cancelTitle: '取消',
    applyTitle: '应用',
    saveShortcut: true,
  },
)

const emit = defineEmits<{
  apply: []
  toggle: []
}>()

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
const saveShortcutLabel = isMac ? '⌘S' : 'Ctrl+S'
const applyTooltip = computed(() =>
  props.saveShortcut ? `${props.applyTitle} (${saveShortcutLabel})` : props.applyTitle,
)

// Stops a double-tap from submitting twice, without blocking a retry after a failed save.
const SAVE_SHORTCUT_THROTTLE_MS = 500
let lastApplyAt = 0

const handleSaveShortcut = (event: KeyboardEvent) => {
  if (!props.editing || !props.saveShortcut) return
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
  if (event.key.toLowerCase() !== 's' && event.code !== 'KeyS') return

  // Suppress the browser's "Save page" dialog.
  event.preventDefault()
  // An open IME composition has not reached v-model yet, so the value would be stale.
  if (event.isComposing || event.repeat) return

  const now = Date.now()
  if (now - lastApplyAt < SAVE_SHORTCUT_THROTTLE_MS) return
  lastApplyAt = now
  emit('apply')
}

onMounted(() => window.addEventListener('keydown', handleSaveShortcut))
onBeforeUnmount(() => window.removeEventListener('keydown', handleSaveShortcut))

const handleSecondaryClick = () => {
  emit('toggle')
}
</script>
