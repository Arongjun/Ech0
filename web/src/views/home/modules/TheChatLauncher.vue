<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <Teleport to="body">
    <Transition name="chat-launcher">
      <div
        v-if="modelValue"
        class="chat-launcher"
        role="dialog"
        aria-modal="true"
        :aria-label="t('chatLauncher.title')"
        @mousedown.self="close"
      >
        <div class="chat-launcher__stage" @mousedown.self="close">
          <p class="chat-launcher__greeting">{{ t('chatLauncher.greeting') }}</p>

          <div class="chat-launcher__pill">
            <Chat class="chat-launcher__pill-icon" />
            <textarea
              ref="inputRef"
              v-model="draft"
              class="chat-launcher__input"
              rows="1"
              :placeholder="t('chatLauncher.placeholder')"
              :aria-label="t('chatLauncher.title')"
              @input="autoGrow"
              @keydown="onKeydown"
            />
            <button
              type="button"
              class="chat-launcher__send"
              :class="{ 'chat-launcher__send--active': draft.trim().length > 0 }"
              :aria-label="t('chatPanel.send')"
              @click="submit"
            >
              <span class="chat-launcher__send-glyph" aria-hidden="true">↑</span>
            </button>
          </div>

          <div class="chat-launcher__actions">
            <button type="button" class="chat-launcher__history-btn" @click="goToHistory">
              <svg
                class="chat-launcher__history-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M12 7v5l4 2" />
              </svg>
              <span>{{ t('chatLauncher.enterHistory') }}</span>
              <span class="chat-launcher__history-arrow" aria-hidden="true">→</span>
            </button>
          </div>

          <p class="chat-launcher__hint" aria-hidden="true">
            <kbd>↵</kbd>{{ t('chatLauncher.kbdEnter') }}
            <span class="chat-launcher__hint-sep">·</span>
            <kbd>esc</kbd>{{ t('chatLauncher.kbdClose') }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Chat from '@/components/icons/chat.vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const { t } = useI18n()
const router = useRouter()

const draft = ref<string>('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const close = () => {
  emit('update:modelValue', false)
}

const autoGrow = () => {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.3)}px`
}

const submit = () => {
  const q = draft.value.trim()
  close()
  router.push({ name: 'chat', query: q.length > 0 ? { q } : undefined })
}

const goToHistory = () => {
  close()
  router.push({ name: 'chat' })
}

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    submit()
  }
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      draft.value = ''
      void nextTick(() => {
        inputRef.value?.focus()
        autoGrow()
      })
    }
  },
)
</script>

<style scoped>
.chat-launcher {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgb(15 23 42 / 28%);
  backdrop-filter: blur(16px) saturate(160%);
  backdrop-filter: blur(16px) saturate(160%);
}

:root.dark .chat-launcher {
  background: rgb(0 0 0 / 48%);
}

.chat-launcher__stage {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: clamp(6rem, 22vh, 12rem) 1.5rem 1.5rem;
  gap: 1.6rem;
}

.chat-launcher__greeting {
  margin: 0;
  font-size: clamp(1.4rem, 3vw, 1.9rem);
  font-weight: 600;
  letter-spacing: -0.01em;
  text-align: center;
  color: var(--color-text-primary);
}

.chat-launcher__pill {
  display: flex;
  align-items: flex-end;
  gap: 0.65rem;
  width: min(40rem, 100%);
  padding: 0.75rem 1.25rem;
  background: var(--ag-glass-strong, var(--color-bg-surface));
  backdrop-filter: blur(24px) saturate(180%);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--ag-line);
  border-radius: var(--ag-radius-lg, 24px);
  box-shadow: var(--ag-shadow);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.chat-launcher__pill:focus-within {
  border-color: var(--ag-blue, var(--color-accent));
  box-shadow:
    var(--ag-shadow),
    0 0 0 3px rgb(10 132 255 / 20%);
}

.chat-launcher__pill-icon {
  width: 1.2rem;
  height: 1.2rem;
  margin-bottom: 0.4rem;
  color: var(--color-text-muted);
  flex: none;
}

:deep(.chat-launcher__pill-icon path) {
  fill: currentColor;
}

.chat-launcher__input {
  flex: 1 1 auto;
  min-width: 0;
  resize: none;
  max-height: 30vh;
  padding: 0.2rem 0;
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-primary);
  background: transparent;
  border: 0;
  outline: none;
  caret-color: var(--ag-blue, var(--color-accent));
  overflow-y: auto;
}

.chat-launcher__input::placeholder {
  color: var(--color-text-muted);
}

.chat-launcher__send {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: var(--color-bg-muted);
  color: var(--color-text-muted);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background 0.15s ease,
    transform 0.12s ease,
    filter 0.15s ease;
}

.chat-launcher__send--active {
  background: var(--ag-blue, var(--color-accent));
  color: #fff;
  box-shadow: 0 4px 12px rgb(10 132 255 / 35%);
}

.chat-launcher__send:hover {
  transform: translateY(-1px);
  filter: brightness(1.03);
}

.chat-launcher__send:active {
  transform: translateY(0);
}

.chat-launcher__send-glyph {
  font-size: 1.05rem;
  line-height: 1;
  font-weight: 700;
  font-variant-emoji: text;
}

.chat-launcher__actions {
  display: flex;
  align-items: center;
  justify-content: center;
}

.chat-launcher__history-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.48rem 1.15rem;
  border-radius: 9999px;
  background: var(--ag-glass-soft, rgb(255 255 255 / 65%));
  backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  border: 1px solid var(--ag-line, rgb(55 48 42 / 12%));
  color: var(--color-text-secondary);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.chat-launcher__history-btn:hover {
  color: var(--ag-blue, #0a84ff);
  background: #fff;
  border-color: rgb(10 132 255 / 35%);
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgb(10 132 255 / 15%);
}

:root.dark .chat-launcher__history-btn {
  background: rgb(30 41 59 / 70%);
  border-color: rgb(255 255 255 / 12%);
  color: var(--color-text-primary);
}

:root.dark .chat-launcher__history-btn:hover {
  background: rgb(51 65 85 / 85%);
  border-color: rgb(10 132 255 / 45%);
}

.chat-launcher__history-btn:active {
  transform: translateY(0);
}

.chat-launcher__history-icon {
  width: 1.05rem;
  height: 1.05rem;
  color: var(--ag-blue, #0a84ff);
}

.chat-launcher__history-arrow {
  font-size: 0.85rem;
  opacity: 0.6;
  transition: transform 0.18s ease;
}

.chat-launcher__history-btn:hover .chat-launcher__history-arrow {
  opacity: 1;
  transform: translateX(2px);
}

.chat-launcher__hint {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  font-size: 0.72rem;
  color: var(--color-text-muted);
  opacity: 0.7;
  letter-spacing: 0.01em;
}

.chat-launcher__hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.15rem;
  height: 1.15rem;
  margin-right: 0.25rem;
  padding: 0 0.28rem;
  font-family: var(--font-family-mono, monospace);
  font-size: 0.66rem;
  line-height: 1;
  color: var(--color-text-secondary);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
}

.chat-launcher__hint-sep {
  opacity: 0.6;
}

@media (width <= 640px) {
  .chat-launcher__stage {
    padding-top: 4.5rem;
  }

  .chat-launcher__hint {
    display: none;
  }
}

.chat-launcher-enter-active,
.chat-launcher-leave-active {
  transition: opacity 0.2s ease;
}

.chat-launcher-enter-active .chat-launcher__stage,
.chat-launcher-leave-active .chat-launcher__stage {
  transition:
    transform 0.24s cubic-bezier(0.2, 0.9, 0.3, 1.1),
    opacity 0.24s ease;
}

.chat-launcher-enter-from,
.chat-launcher-leave-to {
  opacity: 0;
}

.chat-launcher-enter-from .chat-launcher__stage,
.chat-launcher-leave-to .chat-launcher__stage {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
