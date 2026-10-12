<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div ref="rootEl" class="hairline-chat" :class="{ 'hairline-chat--empty': isEmpty }">
    <!-- iOS Frosted Glass Topbar -->
    <header class="chat-topbar">
      <button class="topbar-btn topbar-btn--back" :title="t('commonNav.backHome')" @click="goHome">
        <Back class="topbar-btn__icon" />
        <span class="topbar-btn__label">{{ t('commonNav.back') }}</span>
      </button>

      <div class="topbar-title">
        <span class="topbar-title__glow" />
        <span class="topbar-title__text">{{ siteTitle }}</span>
        <span class="topbar-title__badge">AI</span>
      </div>

      <div class="topbar-actions">
        <button
          v-if="messages.length > 0"
          class="topbar-btn topbar-btn--clear"
          :title="t('chatPanel.clear')"
          @click="handleClear"
        >
          <Close class="topbar-btn__icon" />
        </button>
      </div>
    </header>

    <!-- Transcript Scroll Area -->
    <div ref="scrollArea" class="transcript">
      <div
        ref="transcriptInner"
        class="transcript__inner"
        :style="{ '--tail-space': tailSpace + 'px' }"
      >
        <!-- Empty State Hero -->
        <div v-if="isEmpty" class="chat-hero">
          <div class="chat-hero__icon-wrap">
            <Chat class="chat-hero__icon" />
          </div>
          <h1 class="chat-hero__title">{{ siteTitle }}</h1>
          <p class="chat-hero__subtitle">{{ t('chatPanel.suggestionsTitle') }}</p>
          <div class="chat-hero__suggestions">
            <button
              v-for="(s, i) in suggestions"
              :key="i"
              class="chat-hero__chip"
              @click="send(s)"
            >
              <span class="chat-hero__chip-sparkle">✦</span>
              <span class="chat-hero__chip-text">{{ s }}</span>
            </button>
          </div>
        </div>

        <!-- Conversation Stream -->
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          class="turn"
          :class="msg.role === 'user' ? 'turn--user' : 'turn--ai'"
        >
          <p v-if="msg.role === 'user'" class="bubble">{{ msg.content }}</p>

          <template v-else>
            <div v-if="hasTrace(msg)" class="trace">
              <ChatReasoning
                v-if="msg.reasoning !== undefined"
                :text="msg.reasoning"
                :active="msg.reasoningActive"
                :duration-ms="msg.reasoning_ms"
              />

              <ChatRetrieval
                v-if="(msg.searches && msg.searches.length > 0) || msg.coverage"
                :searches="msg.searches ?? []"
                :coverage="msg.coverage"
                :active="isStreaming(idx) && msg.content.length === 0"
              />
            </div>

            <ChatWaiting
              v-if="msg.content.length === 0 && isStreaming(idx) && !msg.reasoningActive"
            />
            <div v-else-if="msg.content.length > 0" class="answer">
              <AnimatedMarkdown
                v-if="showAnimated(idx)"
                :content="msg.content"
                :streaming="isStreaming(idx)"
                animation="blurIn"
                @update:revealing="assistantRevealing = $event"
              />
              <TheMdPreview v-else :content="msg.content" />
            </div>

            <ChatAskExchange
              v-for="(exchange, ei) in msg.asks ?? []"
              :key="ei"
              :exchange="exchange"
            />

            <ChatAskPicker
              v-if="openAskOn(msg)"
              :ask="openAskOn(msg)!"
              :index="askDraft!.index"
              :pending="askPending"
              :error="askError"
              @answer="submitAskAnswer"
              @back="askBack"
            />

            <ChatSources
              v-if="msg.sources && msg.sources.length > 0"
              :sources="msg.sources"
              @open="goToEcho"
            />

            <ChatActions
              v-if="showActions(idx)"
              :text="msg.content"
              :can-retry="canRetry(idx)"
              :hint="retryHint(idx)"
              @retry="retryLast"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Long Thread Question Navigation (Desktop) -->
    <nav v-if="questionNav.length > 0" class="qnav" :aria-label="t('chatPanel.navLabel')">
      <ul class="qnav__list">
        <li v-for="item in questionNav" :key="item.idx">
          <button
            class="qnav__item"
            :class="{ 'qnav__item--active': item.idx === activeQuestionIdx }"
            :title="item.content"
            :aria-current="item.idx === activeQuestionIdx ? 'true' : undefined"
            @click="scrollToQuestion(item.idx)"
          >
            <span class="qnav__label">{{ item.content }}</span>
            <span class="qnav__pill" />
          </button>
        </li>
      </ul>
    </nav>

    <!-- Bottom Dock: Suggestions & Floating Capsule Composer -->
    <div ref="dockEl" class="chat-bottom-dock">
      <!-- In-Conversation Quick Suggestion Chips -->
      <Transition name="chips-fade">
        <div v-if="!isEmpty && showSuggestions" class="chat-dock__chips">
          <button
            v-for="(s, i) in suggestions"
            :key="i"
            class="chat-dock__chip"
            @click="send(s)"
          >
            <span class="chat-dock__chip-sparkle">✦</span>
            <span class="chat-dock__chip-text">{{ s }}</span>
          </button>
        </div>
      </Transition>

      <div
        ref="composerEl"
        class="composer"
        :class="{
          'composer--active': input.trim().length > 0 || loading,
          'composer--loading': loading,
        }"
      >
        <textarea
          ref="inputEl"
          v-model="input"
          class="composer__field"
          rows="1"
          :placeholder="t('chatPanel.inputPlaceholder')"
          @input="autoGrow"
          @keydown="handleKeydown"
          @blur="handleBlur"
        />
        <Transition name="send-pop">
          <button
            v-if="loading"
            class="composer__action composer__action--stop"
            :title="t('chatPanel.clear')"
            @click="handleStop"
          >
            <span class="composer__stop-glyph" />
          </button>
          <button
            v-else
            class="composer__action composer__action--send"
            :class="{ 'composer__action--disabled': !canSend }"
            :disabled="!canSend"
            :title="t('chatPanel.send')"
            @click="send(input)"
          >
            <Send class="composer__send-icon" />
          </button>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Back from '@/components/icons/back.vue'
import Close from '@/components/icons/close.vue'
import Send from '@/components/icons/send.vue'
import Chat from '@/components/icons/chat.vue'
import { TheMdPreview } from '@/components/advanced/md'
import AnimatedMarkdown from './AnimatedMarkdown.vue'
import ChatSources from './ChatSources.vue'
import ChatReasoning from './ChatReasoning.vue'
import ChatRetrieval from './ChatRetrieval.vue'
import ChatWaiting from './ChatWaiting.vue'
import ChatActions from './ChatActions.vue'
import ChatAskPicker from './ChatAskPicker.vue'
import ChatAskExchange from './ChatAskExchange.vue'
import { ref, computed, nextTick, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { chatStream } from '@/service/api'
import { getChatSession, clearChatSession, answerChatAsk } from '@/service/api/chat'
import { useBaseDialog } from '@/composables/useBaseDialog'
import { theToast } from '@/utils/toast'
import { useSettingStore } from '@/stores'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { openConfirm } = useBaseDialog()
const settingStore = useSettingStore()

const siteTitle = computed<string>(() => settingStore.SystemSetting.site_title?.trim() || 'Ech0')

const input = ref<string>('')
const loading = ref<boolean>(false)
const messages = ref<App.Api.Chat.ChatMessage[]>([])
const rootEl = ref<HTMLElement | null>(null)
const scrollArea = ref<HTMLElement | null>(null)
const transcriptInner = ref<HTMLElement | null>(null)
const composerEl = ref<HTMLElement | null>(null)
const dockEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
let abort: (() => void) | null = null

const canSend = computed<boolean>(() => !loading.value && input.value.trim().length > 0)

const assistantRevealing = ref<boolean>(false)

const isStreaming = (idx: number): boolean => loading.value && idx === messages.value.length - 1

const showAnimated = (idx: number): boolean => {
  const last = messages.value.length - 1
  if (idx !== last || messages.value[idx]?.role !== 'assistant') return false
  return loading.value || assistantRevealing.value
}

const suggestions = computed<string[]>(() => [
  t('chatPanel.suggestion1'),
  t('chatPanel.suggestion2'),
  t('chatPanel.suggestion3'),
])

const showSuggestions = computed<boolean>(() => !loading.value && input.value.trim().length === 0)

const isEmpty = computed<boolean>(() => messages.value.length === 0)

const MAX_NAV_QUESTIONS = 7

const questionNav = computed<{ idx: number; content: string }[]>(() =>
  messages.value
    .map((m, idx) => ({ idx, content: m.content, role: m.role }))
    .filter((m) => m.role === 'user')
    .slice(-MAX_NAV_QUESTIONS)
    .map(({ idx, content }) => ({ idx, content })),
)

const activeQuestionIdx = ref<number>(-1)

const NAV_TOP_GUTTER = 84

const turnElAt = (idx: number): HTMLElement | null =>
  (transcriptInner.value?.children[idx] as HTMLElement | undefined) ?? null

const updateActiveQuestion = () => {
  const area = scrollArea.value
  const nav = questionNav.value
  if (!area || nav.length === 0) {
    activeQuestionIdx.value = -1
    return
  }
  const refLine = area.getBoundingClientRect().top + NAV_TOP_GUTTER + 8
  let active = nav[0].idx
  for (const item of nav) {
    const el = turnElAt(item.idx)
    if (!el) continue
    if (el.getBoundingClientRect().top <= refLine) active = item.idx
    else break
  }
  activeQuestionIdx.value = active
}

let navRaf = 0
const scheduleActiveUpdate = () => {
  if (navRaf) return
  navRaf = requestAnimationFrame(() => {
    navRaf = 0
    updateActiveQuestion()
  })
}

const scrollToQuestion = async (idx: number) => {
  const area = scrollArea.value
  const el = turnElAt(idx)
  if (!area || !el) return
  pinned.value = false
  activeQuestionIdx.value = idx
  jumping = true
  if (jumpTimer) clearTimeout(jumpTimer)
  const delta = el.getBoundingClientRect().top - area.getBoundingClientRect().top
  const target = area.scrollTop + delta - NAV_TOP_GUTTER
  const realMax = area.scrollHeight - tailSpace.value - area.clientHeight
  tailSpace.value = target > realMax ? area.clientHeight : 0
  await nextTick()
  jumpTimer = window.setTimeout(() => {
    jumping = false
    jumpTimer = 0
  }, 700)
  area.scrollTo({ top: target, behavior: 'smooth' })
}

const STICK_THRESHOLD = 80
const pinned = ref<boolean>(true)
let resizeObserver: ResizeObserver | null = null

const tailSpace = ref<number>(0)
let jumping = false
let jumpTimer = 0

const collapseTailIfSafe = () => {
  const el = scrollArea.value
  if (!el || tailSpace.value === 0) return
  const maxAfter = el.scrollHeight - tailSpace.value - el.clientHeight
  if (el.scrollTop <= maxAfter + 1) tailSpace.value = 0
}

const jumpToBottom = () => {
  nextTick(() => {
    const el = scrollArea.value
    if (el) el.scrollTop = el.scrollHeight - tailSpace.value - el.clientHeight
  })
}

const onScroll = () => {
  const el = scrollArea.value
  if (!el) return
  pinned.value = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_THRESHOLD
  if (!jumping) {
    if (pinned.value) tailSpace.value = 0
    else collapseTailIfSafe()
  }
  scheduleActiveUpdate()
}

const onContentResize = () => {
  const el = scrollArea.value
  if (el && pinned.value) el.scrollTop = el.scrollHeight - tailSpace.value - el.clientHeight
  scheduleActiveUpdate()
}

const syncComposerHeight = () => {
  const root = rootEl.value
  const c = composerEl.value
  if (root && c) root.style.setProperty('--composer-h', `${c.offsetHeight}px`)
}

const syncDockHeight = () => {
  const root = rootEl.value
  const dock = dockEl.value
  if (root && dock) {
    root.style.setProperty('--dock-h', `${dock.offsetHeight}px`)
  }
}

const autoGrow = () => {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
  syncComposerHeight()
  syncDockHeight()
  onContentResize()
}

const handleBlur = () => {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

const handleViewportScroll = () => {
  if (typeof window !== 'undefined' && window.scrollY !== 0) {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }
}

const goHome = () => router.push('/')
const goToEcho = (echoId: string) => router.push(`/echo/${echoId}`)

const askDraft = ref<{
  askId: string
  index: number
  answers: App.Api.Chat.ChatAskAnswer[]
} | null>(null)
const askPending = ref<boolean>(false)
const askError = ref<string>('')

const openAskOn = (msg: App.Api.Chat.ChatMessage): App.Api.Chat.ChatAsk | undefined => {
  const ask = msg.pendingAsk
  return ask && askDraft.value?.askId === ask.ask_id ? ask : undefined
}

const askedMessage = (askId: string): App.Api.Chat.ChatMessage | undefined =>
  messages.value.find((m) => m.pendingAsk?.ask_id === askId)

const dropAsk = (askId?: string) => {
  for (const m of messages.value) {
    if (m.pendingAsk && (askId === undefined || m.pendingAsk.ask_id === askId)) {
      m.pendingAsk = undefined
    }
  }
  if (askId === undefined || askDraft.value?.askId === askId) {
    askDraft.value = null
    askPending.value = false
    askError.value = ''
  }
}

const askBack = () => {
  const draft = askDraft.value
  if (!draft || askPending.value || draft.index === 0) return
  askDraft.value = { ...draft, index: draft.index - 1 }
  askError.value = ''
}

const submitAskAnswer = async (answer: App.Api.Chat.ChatAskAnswer): Promise<boolean> => {
  const draft = askDraft.value
  if (!draft || askPending.value) return true
  const msg = askedMessage(draft.askId)
  const questions = msg?.pendingAsk?.questions
  if (!msg || !questions || draft.index >= questions.length) return true

  const answers = [...draft.answers.slice(0, draft.index), answer]
  if (draft.index < questions.length - 1) {
    askDraft.value = { askId: draft.askId, index: draft.index + 1, answers }
    askError.value = ''
    return true
  }

  askPending.value = true
  askError.value = ''
  let delivered = false
  try {
    delivered = (await answerChatAsk(draft.askId, answers)).code === 1
  } catch {
    delivered = false
  }
  askPending.value = false

  if (askDraft.value?.askId !== draft.askId) return true

  if (!delivered) {
    askDraft.value = { askId: draft.askId, index: draft.index, answers }
    askError.value = String(t('chatPanel.askSubmitFailed'))
    return false
  }

  msg.asks = [...(msg.asks ?? []), { questions, answers }]
  msg.pendingAsk = undefined
  askDraft.value = null
  return true
}

const streamInto = (question: string, assistant: App.Api.Chat.ChatMessage) => {
  loading.value = true
  assistantRevealing.value = true
  pinned.value = true
  tailSpace.value = 0
  jumping = false
  if (jumpTimer) {
    clearTimeout(jumpTimer)
    jumpTimer = 0
  }
  nextTick(autoGrow)
  jumpToBottom()

  abort = chatStream(question, {
    onSearching: (query) => {
      if (query && !assistant.searches?.includes(query)) {
        assistant.searches?.push(query)
      }
    },
    onSources: (sources) => {
      const merged = assistant.sources ? [...assistant.sources] : []
      const seen = new Set(merged.map((s) => s.echo_id))
      for (const src of sources) {
        if (!seen.has(src.echo_id)) {
          seen.add(src.echo_id)
          merged.push(src)
        }
      }
      assistant.sources = merged
    },
    onCoverage: (coverage) => {
      assistant.coverage = coverage
    },
    onReasoning: (text) => {
      if (assistant.reasoning === undefined) {
        assistant.reasoning = ''
        assistant.reasoningActive = true
      }
      assistant.reasoning += text
    },
    onReasoningDone: (durationMs) => {
      assistant.reasoning_ms = durationMs
      assistant.reasoningActive = false
    },
    onDelta: (text) => {
      assistant.content += text
    },
    onAsk: (ask) => {
      assistant.pendingAsk = ask
      askDraft.value = { askId: ask.ask_id, index: 0, answers: [] }
      askPending.value = false
      askError.value = ''
    },
    onAskClosed: (askId) => {
      dropAsk(askId)
    },
    onAskMalformed: () => {
      theToast.error(String(t('chatPanel.askMalformed')))
    },
    onError: (message) => {
      loading.value = false
      dropAsk()
      assistant.failed = true
      theToast.error(message || String(t('chatPanel.errorGeneric')))
    },
    onDone: () => {
      loading.value = false
      dropAsk()
    },
  })
}

const send = (question: string) => {
  const q = question.trim()
  if (q.length === 0) return

  const draft = askDraft.value
  if (draft) {
    if (askPending.value) return
    const current = askedMessage(draft.askId)?.pendingAsk?.questions[draft.index]
    if (!current) return
    input.value = ''
    nextTick(autoGrow)
    void submitAskAnswer({ question_id: current.id, selected: [], custom: q }).then((ok) => {
      if (ok) return
      input.value = q
      nextTick(autoGrow)
    })
    return
  }

  if (loading.value) return

  messages.value.push({ role: 'user', content: q })
  messages.value.push({ role: 'assistant', content: '', sources: [], searches: [] })
  input.value = ''
  streamInto(q, messages.value[messages.value.length - 1])
}

const hasTrace = (msg: App.Api.Chat.ChatMessage): boolean =>
  msg.reasoning !== undefined ||
  (msg.searches !== undefined && msg.searches.length > 0) ||
  msg.coverage !== undefined

const canRetry = (idx: number): boolean =>
  !loading.value &&
  messages.value.length >= 2 &&
  idx === messages.value.length - 1 &&
  messages.value[idx]?.role === 'assistant'

const retryHint = (idx: number): string => {
  const m = messages.value[idx]
  if (!m || !canRetry(idx) || m.content.trim().length > 0) return ''
  return String(t('chatPanel.noResponse'))
}

const showActions = (idx: number): boolean => {
  const m = messages.value[idx]
  if (!m || m.role !== 'assistant' || isStreaming(idx)) return false
  return m.content.trim().length > 0 || canRetry(idx)
}

const retryLast = () => {
  if (loading.value) return
  const n = messages.value.length
  if (n < 2) return
  const assistant = messages.value[n - 1]
  const user = messages.value[n - 2]
  if (assistant.role !== 'assistant' || user.role !== 'user') return

  assistant.content = ''
  assistant.sources = []
  assistant.searches = []
  assistant.coverage = undefined
  assistant.failed = false
  assistant.reasoning = undefined
  assistant.reasoning_ms = undefined
  assistant.reasoningActive = false
  assistant.asks = undefined
  dropAsk()
  streamInto(user.content, assistant)
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send(input.value)
  }
}

const handleStop = () => {
  if (abort) abort()
  abort = null
  loading.value = false
  dropAsk()
}

watch(loading, (now, prev) => {
  if (!prev || now) return
  const last = messages.value[messages.value.length - 1]
  if (last?.role === 'assistant' && last.reasoningActive) last.reasoningActive = false
  if (!jumping) collapseTailIfSafe()
})

const handleClear = () => {
  openConfirm({
    title: t('chatPanel.clearConfirmTitle'),
    description: t('chatPanel.clearConfirmDesc'),
    onConfirm: async () => {
      if (abort) abort()
      abort = null
      loading.value = false
      assistantRevealing.value = false
      dropAsk()
      pinned.value = true
      tailSpace.value = 0
      jumping = false
      if (jumpTimer) {
        clearTimeout(jumpTimer)
        jumpTimer = 0
      }
      try {
        await clearChatSession()
      } catch {}
      messages.value = []
      theToast.success(String(t('chatPanel.clearSuccess')))
    },
  })
}

onMounted(async () => {
  const area = scrollArea.value
  if (area) area.addEventListener('scroll', onScroll, { passive: true })
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver((entries) => {
      let composerChanged = false
      let dockChanged = false
      for (const entry of entries) {
        if (entry.target === composerEl.value) composerChanged = true
        if (entry.target === dockEl.value) dockChanged = true
      }
      if (composerChanged) syncComposerHeight()
      if (dockChanged || composerChanged) syncDockHeight()
      onContentResize()
    })
    if (transcriptInner.value) resizeObserver.observe(transcriptInner.value)
    if (composerEl.value) resizeObserver.observe(composerEl.value)
    if (dockEl.value) resizeObserver.observe(dockEl.value)
  }
  syncComposerHeight()
  syncDockHeight()

  try {
    const res = await getChatSession()
    const history = res.data
    if (Array.isArray(history) && history.length > 0) {
      messages.value = history
      pinned.value = true
      jumpToBottom()
    }
  } catch {}
  scheduleActiveUpdate()

  const initialQuery = route.query.q
  const q = Array.isArray(initialQuery) ? initialQuery[0] : initialQuery
  if (typeof q === 'string' && q.trim().length > 0) {
    void router.replace({ query: {} })
    send(q)
  }

  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportScroll)
    window.visualViewport.addEventListener('scroll', handleViewportScroll)
  }
})

watch(
  [showSuggestions, loading, isEmpty],
  () => {
    nextTick(() => {
      syncDockHeight()
      onContentResize()
    })
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', handleViewportScroll)
    window.visualViewport.removeEventListener('scroll', handleViewportScroll)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  scrollArea.value?.removeEventListener('scroll', onScroll)
  if (navRaf) cancelAnimationFrame(navRaf)
  if (jumpTimer) clearTimeout(jumpTimer)
})
</script>

<style scoped>
.hairline-chat {
  --composer-max: min(8.5rem, 30dvh);
  --composer-h: 3.2rem;
  --dock-h: 7.5rem;

  position: relative;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  background: var(--color-bg-canvas);
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
}

/* iOS Glass Topbar */
.chat-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: calc(3.5rem + env(safe-area-inset-top, 0px));
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: env(safe-area-inset-top, 0px) 1.25rem 0;
  box-sizing: border-box;
  background: var(--ag-glass-strong, rgba(255, 255, 255, 0.78));
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-bottom: 1px solid var(--ag-line, rgba(55, 48, 42, 0.1));
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.02);
}

.topbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.38rem 0.8rem;
  border-radius: 9999px;
  background: var(--ag-glass-soft, rgba(255, 255, 255, 0.45));
  border: 1px solid var(--ag-line, rgba(55, 48, 42, 0.1));
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
}

.topbar-btn:hover {
  color: var(--ag-blue, #0a84ff);
  border-color: rgba(10, 132, 255, 0.3);
  background: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.12);
}

.topbar-btn:active {
  transform: translateY(0);
}

.topbar-btn__icon {
  width: 1.05rem;
  height: 1.05rem;
}

.topbar-btn__icon :deep(path) {
  fill: currentColor;
}

.topbar-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-weight: 600;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
  color: var(--color-text-primary);
}

.topbar-title__glow {
  width: 7px;
  height: 7px;
  border-radius: 9999px;
  background: #34c759;
  box-shadow: 0 0 8px rgba(52, 199, 89, 0.6);
}

.topbar-title__badge {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.08rem 0.4rem;
  border-radius: 6px;
  background: linear-gradient(135deg, #0a84ff, #5856d6);
  color: #ffffff;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.topbar-btn--clear {
  padding: 0.38rem 0.45rem;
}

/* Transcript Scroll Area */
.transcript {
  position: absolute;
  top: calc(3.5rem + env(safe-area-inset-top, 0px));
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
  touch-action: pan-y;
  overflow-anchor: none;
}

.transcript__inner {
  width: 100%;
  max-width: 44rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem calc(var(--dock-h, 7.5rem) + 1.5rem + var(--tail-space, 0px));
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-height: 100%;
  box-sizing: border-box;
}

/* Empty State Hero */
.chat-hero {
  margin: auto 0;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.85rem;
  animation: hero-fade-in 0.45s ease both;
}

@keyframes hero-fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.chat-hero__icon-wrap {
  width: 4.25rem;
  height: 4.25rem;
  border-radius: 22px;
  background: linear-gradient(135deg, rgba(10, 132, 255, 0.12), rgba(88, 86, 214, 0.16));
  border: 1px solid rgba(10, 132, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ag-blue, #0a84ff);
  box-shadow: 0 10px 24px rgba(10, 132, 255, 0.12);
}

.chat-hero__icon {
  width: 2.2rem;
  height: 2.2rem;
}

.chat-hero__icon :deep(path) {
  fill: currentColor;
}

.chat-hero__title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
  margin: 0;
}

.chat-hero__subtitle {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  margin: 0 0 0.5rem;
}

.chat-hero__suggestions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
  max-width: 38rem;
}

.chat-hero__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.15rem;
  border-radius: 9999px;
  background: var(--ag-glass-strong, rgba(255, 255, 255, 0.8));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--ag-line, rgba(55, 48, 42, 0.1));
  font-size: 0.88rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  box-shadow: var(--ag-shadow, 0 4px 12px rgba(0, 0, 0, 0.04));
  transition: all 0.22s cubic-bezier(0.2, 0, 0, 1);
}

.chat-hero__chip:hover {
  color: var(--ag-blue, #0a84ff);
  border-color: rgba(10, 132, 255, 0.35);
  background: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(10, 132, 255, 0.14);
}

.chat-hero__chip-sparkle {
  color: var(--ag-blue, #0a84ff);
  font-size: 0.82rem;
}

/* Turn (Message Container) */
.turn {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  animation: turn-in 0.32s ease both;
  contain: layout style;
}

.turn--user {
  align-items: flex-end;
}

.turn--ai {
  align-items: flex-start;
}

@keyframes turn-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.bubble {
  max-width: 82%;
  padding: 0.7rem 1.15rem;
  border-radius: 20px 20px 4px 20px;
  background: linear-gradient(135deg, #0a84ff 0%, #0071e3 100%);
  color: #ffffff;
  font-size: 0.94rem;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  box-shadow: 0 4px 16px rgba(10, 132, 255, 0.25);
  letter-spacing: -0.01em;
}

.answer {
  width: 100%;
  font-size: 0.96rem;
  line-height: 1.75;
}

.answer :deep(.echo-markdown) {
  line-height: 1.8;
}

.trace {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  width: 100%;
  margin-bottom: 0.5rem;
}

/* Bottom Dock */
.chat-bottom-dock {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem calc(0.9rem + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(to top, var(--color-bg-canvas, #fbfcfe) 70%, transparent 100%);
  pointer-events: none;
}

.chat-dock__chips {
  pointer-events: auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
  max-width: 44rem;
  margin-bottom: 0.15rem;
}

.chat-dock__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.85rem;
  border-radius: 9999px;
  background: var(--ag-glass-strong, rgba(255, 255, 255, 0.8));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--ag-line, rgba(55, 48, 42, 0.1));
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  transition: all 0.18s ease;
}

.chat-dock__chip:hover {
  color: var(--ag-blue, #0a84ff);
  border-color: rgba(10, 132, 255, 0.35);
  background: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(10, 132, 255, 0.12);
}

.chat-dock__chip-sparkle {
  color: var(--ag-blue, #0a84ff);
  font-size: 0.78rem;
}

.chips-fade-enter-active,
.chips-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.chips-fade-enter-from,
.chips-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* Floating Frosted Capsule Composer */
.composer {
  pointer-events: auto;
  width: min(44rem, 100%);
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  background: var(--ag-glass-strong, rgba(255, 255, 255, 0.82));
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid var(--ag-line, rgba(55, 48, 42, 0.1));
  border-radius: 28px;
  padding: 0.45rem 0.65rem 0.45rem 1.25rem;
  box-shadow: 0 8px 30px rgba(40, 48, 62, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, background 0.22s ease;
}

.composer:focus-within {
  border-color: rgba(10, 132, 255, 0.45);
  box-shadow: 0 10px 32px rgba(10, 132, 255, 0.12), 0 0 0 3px rgba(10, 132, 255, 0.14);
  background: #ffffff;
}

.composer--loading {
  border-color: rgba(10, 132, 255, 0.35);
}

.composer__field {
  flex: 1;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  padding: 0.45rem 0;
  max-height: var(--composer-max);
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--color-text-primary);
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.composer__field::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}

.composer__field::placeholder {
  color: var(--color-text-muted);
  opacity: 0.75;
}

.composer__action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 9999px;
  border: none;
  background: transparent;
  cursor: pointer;
  margin-bottom: 0.15rem;
  transition: all 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.composer__action--send {
  background: linear-gradient(135deg, #0a84ff 0%, #0071e3 100%);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(10, 132, 255, 0.35);
}

.composer__action--send:hover:not(:disabled) {
  transform: scale(1.06);
  filter: brightness(1.08);
  box-shadow: 0 4px 14px rgba(10, 132, 255, 0.45);
}

.composer__action--send:active:not(:disabled) {
  transform: scale(0.94);
}

.composer__action--send:disabled,
.composer__action--disabled {
  background: rgba(120, 120, 128, 0.12) !important;
  color: rgba(120, 120, 128, 0.38) !important;
  box-shadow: none !important;
  cursor: default !important;
  transform: none !important;
}

.composer__action--stop {
  background: var(--color-text-secondary);
  color: #ffffff;
}

.composer__send-icon {
  width: 1.15rem;
  height: 1.15rem;
  display: block;
}

.composer__send-icon :deep(path) {
  fill: none !important;
  stroke: currentColor !important;
  stroke-width: 2.2px !important;
  stroke-linecap: round !important;
  stroke-linejoin: round !important;
}

.composer__stop-glyph {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 0.15rem;
  background: currentColor;
}

.send-pop-enter-active,
.send-pop-leave-active {
  transition:
    transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.18s ease;
}

.send-pop-enter-from,
.send-pop-leave-to {
  transform: scale(0.5);
  opacity: 0;
}

/* Question Navigation (Desktop side rail) */
.qnav {
  position: absolute;
  top: 50%;
  right: 0;
  transform: translateY(-50%);
  z-index: 8;
  display: flex;
  align-items: center;
  max-height: 72dvh;
  padding-right: 0.4rem;
}

.qnav__list {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.3rem;
  max-height: 72dvh;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
  scrollbar-width: none;
}

.qnav__list::-webkit-scrollbar {
  display: none;
}

.qnav__item {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  padding: 0.22rem 0.3rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  transition: background 0.22s ease;
}

.qnav__label {
  max-width: 0;
  margin-right: 0;
  overflow: hidden;
  font-size: 0.78rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
  white-space: nowrap;
  text-overflow: ellipsis;
  opacity: 0;
  transition:
    max-width 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    margin 0.28s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.qnav__pill {
  flex-shrink: 0;
  width: 1.1rem;
  height: 0.26rem;
  border-radius: 999px;
  background: var(--color-text-muted);
  opacity: 0.6;
  transition:
    width 0.22s ease,
    opacity 0.22s ease,
    background 0.22s ease;
}

.qnav__item--active .qnav__pill {
  width: 1.7rem;
  background: var(--ag-blue, #0a84ff);
  opacity: 1;
}

.qnav__item:hover .qnav__pill {
  opacity: 0.85;
}

.qnav:hover .qnav__item {
  background: color-mix(in srgb, var(--color-bg-canvas) 94%, transparent);
  backdrop-filter: blur(10px);
}

.qnav:hover .qnav__label {
  max-width: min(38vw, 15rem);
  margin-right: 0.5rem;
  opacity: 1;
}

.qnav:hover .qnav__item--active .qnav__label {
  color: var(--color-text-primary);
  font-weight: 500;
}

@media (hover: none), (width <= 768px) {
  .qnav {
    display: none;
  }
}

@media (width <= 640px) {
  .chat-topbar {
    padding: 0 0.85rem;
  }

  .topbar-btn__label {
    display: none;
  }

  .transcript__inner {
    padding-left: 1rem;
    padding-right: 1rem;
    padding-bottom: calc(var(--dock-h, 7.5rem) + 2rem + var(--tail-space, 0px));
  }

  .chat-bottom-dock {
    padding-left: 0.85rem;
    padding-right: 0.85rem;
  }

  .chat-dock__chips {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    width: 100%;
    max-width: 100%;
    padding: 0.15rem 0.25rem 0.35rem;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .chat-dock__chips::-webkit-scrollbar {
    display: none;
  }

  .chat-dock__chip {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 0.8rem;
    padding: 0.3rem 0.75rem;
  }

  .composer {
    padding: 0.4rem 0.5rem 0.4rem 1rem;
    border-radius: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .turn,
  .chat-hero,
  .composer,
  .qnav__item,
  .qnav__label,
  .qnav__pill {
    animation: none;
    transition: none;
  }
}
</style>
