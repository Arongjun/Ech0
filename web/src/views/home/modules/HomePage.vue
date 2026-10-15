<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="home-page">
    <div class="home-shell">
      <div class="home-layout">
        <div
          ref="mainColumn"
          class="home-main"
          :class="{ 'home-main--unclipped': activeTab === 'tags' }"
        >
          <div class="home-main-track">
            <HomeHeader class="mb-3" />
            <aside class="home-aside home-aside--mobile">
              <HomeSidebarNav
                v-model:mobile-search-open="mobileSearchOpen"
                @open-palette="paletteOpen = true"
                @open-chat="chatLauncherOpen = true"
              />
            </aside>
            <div
              v-if="activeTab === 'publish'"
              class="home-content-block home-content-block--publish"
            >
              <TheEditor />
            </div>
            <div v-else-if="activeTab === 'tags'" class="home-content-block">
              <TheTagsManager />
            </div>

            <template v-else-if="activeTab === 'home'">
              <HomeBanner :class="{ 'home-banner--mobile-hidden': shouldHideBannerOnMobile }" />

              <TheEchos compact :scroll-target="mainColumn" />
            </template>

            <div v-else-if="activeTab === 'status'" class="home-content-block home-status-widgets">
              <TheHeatMap />
              <TheRecentCard v-if="AgentSetting.enable" />
              <TheConnectWidget />
              <TheCommentWidget />
            </div>
            <HubPage v-else embedded :scroll-target="mainColumn" />
          </div>
        </div>

        <aside class="home-aside home-aside--rail">
          <HomeSidebarNav />
          <div class="home-aside__filter-block">
            <TheFilter
              show-chat-trigger
              @open-palette="paletteOpen = true"
              @open-chat="chatLauncherOpen = true"
            />
            <div class="home-aside__version">
              version: {{ settingStore.hello?.version || '--' }}
            </div>
          </div>
        </aside>
      </div>
    </div>
    <TheCommandPalette v-model="paletteOpen" />
    <TheChatLauncher v-model="chatLauncherOpen" />
  </div>
</template>

<script setup lang="ts">
import HomeHeader from './HomeHeader.vue'
import HomeBanner from './HomeBanner.vue'
import HomeSidebarNav from './HomeSidebarNav.vue'
import TheFilter from './TheFilter.vue'
import TheEchos from './TheEchos.vue'
import TheCommandPalette from './TheCommandPalette.vue'
import TheChatLauncher from './TheChatLauncher.vue'
import {
  defineAsyncComponent,
  onMounted,
  ref,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  computed,
  watch,
} from 'vue'
import { useEchoStore, useUserStore, useSettingStore } from '@/stores'
import { useRoute, onBeforeRouteLeave } from 'vue-router'
import { storeToRefs } from 'pinia'
import {
  TheCommentWidget,
  TheConnectWidget,
  TheHeatMap,
  TheRecentCard,
} from '@/components/advanced/widget'
import { sessionStg } from '@/utils/storage'

const route = useRoute()
const TheEditor = defineAsyncComponent(() => import('./TheEditor.vue'))
const TheTagsManager = defineAsyncComponent(() => import('./TheEditor/TheTagsManager.vue'))
const HubPage = defineAsyncComponent(() => import('@/views/hub/modules/HubPage.vue'))

const userStore = useUserStore()
const settingStore = useSettingStore()
const echoStore = useEchoStore()
const { isLogin } = storeToRefs(userStore)
const { AgentSetting } = storeToRefs(settingStore)
const { searchingMode, isFilteringMode } = storeToRefs(echoStore)
const mobileSearchOpen = ref(false)
const activeTab = computed<'home' | 'publish' | 'status' | 'tags' | 'hub'>(() => {
  if (route.query.tab === 'publish' && isLogin.value) return 'publish'
  if (route.query.tab === 'status') return 'status'
  if (route.query.tab === 'tags') return 'tags'
  if (route.query.tab === 'hub') return 'hub'
  return 'home'
})
const shouldHideBannerOnMobile = computed(
  () => mobileSearchOpen.value || searchingMode.value || isFilteringMode.value,
)

const mainColumn = ref<HTMLElement | null>(null)
const TIMELINE_SCROLL_KEY = 'home:timeline:scrollTop'
const WINDOW_SCROLL_KEY = 'home:window:scrollTop'
const LAST_ACTIVE_ECHO_KEY = 'home:lastActiveEchoId'
const LAST_ACTIVE_VIEWPORT_TOP_KEY = 'home:lastActiveEcho:viewportTop'
const LAST_ACTIVE_VIEWPORT_RATIO_KEY = 'home:lastActiveEcho:viewportRatio'
let currentTimelineScrollTop = 0
let currentWindowScrollTop = 0
let scrollDebounceTimer: ReturnType<typeof setTimeout> | null = null
const isNavigatingAway = ref(false)
const isRestoringScroll = ref(false)
let scrollListenersBound = false

const paletteOpen = ref<boolean>(false)
const chatLauncherOpen = ref<boolean>(false)
const chatAvailable = computed(() => isLogin.value && AgentSetting.value.enable)

const handleGlobalKeydown = (event: KeyboardEvent) => {
  const withModifier = (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
  const isSearchShortcut = withModifier && event.key === 'k'
  if (isSearchShortcut) {
    event.preventDefault()
    paletteOpen.value = !paletteOpen.value
    return
  }
  const isChatShortcut = withModifier && event.key === 'j'
  if (isChatShortcut && chatAvailable.value) {
    event.preventDefault()
    chatLauncherOpen.value = !chatLauncherOpen.value
    return
  }
  if (event.key === 'Escape') {
    if (paletteOpen.value) paletteOpen.value = false
    if (chatLauncherOpen.value) chatLauncherOpen.value = false
  }
}

const flushScrollPositions = () => {
  if (scrollDebounceTimer !== null) {
    clearTimeout(scrollDebounceTimer)
    scrollDebounceTimer = null
  }
  if (isRestoringScroll.value || isNavigatingAway.value) return

  if (mainColumn.value) {
    currentTimelineScrollTop = Math.round(mainColumn.value.scrollTop)
    sessionStg.setItem(TIMELINE_SCROLL_KEY, String(currentTimelineScrollTop))
  }
  if (typeof window !== 'undefined') {
    currentWindowScrollTop = Math.round(window.scrollY)
    sessionStg.setItem(WINDOW_SCROLL_KEY, String(currentWindowScrollTop))
  }
}

const scheduleScrollSave = () => {
  if (isRestoringScroll.value || isNavigatingAway.value) return
  if (scrollDebounceTimer !== null) return
  scrollDebounceTimer = setTimeout(flushScrollPositions, 150)
}

const saveTimelineScrollPosition = () => {
  if (isNavigatingAway.value || isRestoringScroll.value || !mainColumn.value) return
  currentTimelineScrollTop = Math.round(mainColumn.value.scrollTop)
  scheduleScrollSave()
}

const saveWindowScrollPosition = () => {
  if (isNavigatingAway.value || isRestoringScroll.value || typeof window === 'undefined') return
  currentWindowScrollTop = Math.round(window.scrollY)
  scheduleScrollSave()
}

const bindScrollListeners = () => {
  if (scrollListenersBound) return
  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', saveWindowScrollPosition, { passive: true })
  }
  if (mainColumn.value) {
    mainColumn.value.addEventListener('scroll', saveTimelineScrollPosition, { passive: true })
  }
  scrollListenersBound = true
}

const unbindScrollListeners = () => {
  if (!isRestoringScroll.value) {
    flushScrollPositions()
  }
  if (!scrollListenersBound) return
  if (typeof window !== 'undefined') {
    window.removeEventListener('scroll', saveWindowScrollPosition)
  }
  if (mainColumn.value) {
    mainColumn.value.removeEventListener('scroll', saveTimelineScrollPosition)
  }
  if (scrollDebounceTimer !== null) {
    clearTimeout(scrollDebounceTimer)
    scrollDebounceTimer = null
  }
  scrollListenersBound = false
}

const restoreTimelineScrollPosition = async () => {
  isRestoringScroll.value = true
  try {
    const rawTimeline = sessionStg.getItem(TIMELINE_SCROLL_KEY)
    const timelineTop = rawTimeline ? Number(rawTimeline) : 0
    const rawWindow = sessionStg.getItem(WINDOW_SCROLL_KEY)
    const windowTop = rawWindow ? Number(rawWindow) : 0
    const lastEchoId = sessionStg.getItem(LAST_ACTIVE_ECHO_KEY)
    const rawViewportTop = sessionStg.getItem(LAST_ACTIVE_VIEWPORT_TOP_KEY)
    const savedViewportTop =
      rawViewportTop !== null && rawViewportTop !== undefined ? Number(rawViewportTop) : null
    const rawViewportRatio = sessionStg.getItem(LAST_ACTIVE_VIEWPORT_RATIO_KEY)
    const savedViewportRatio =
      rawViewportRatio !== null && rawViewportRatio !== undefined ? Number(rawViewportRatio) : null

    const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 820

    // Step 1: Immediate rough restoration (if window/timeline is not already at target)
    if (isDesktop && mainColumn.value && Number.isFinite(timelineTop) && timelineTop > 0) {
      if (Math.abs(mainColumn.value.scrollTop - timelineTop) > 2) {
        mainColumn.value.scrollTop = timelineTop
      }
    } else if (
      !isDesktop &&
      typeof window !== 'undefined' &&
      Number.isFinite(windowTop) &&
      windowTop > 0
    ) {
      if (Math.abs(window.scrollY - windowTop) > 2) {
        window.scrollTo({ top: windowTop, behavior: 'instant' as ScrollBehavior })
      }
    }

    // Step 2: Element-level fine-alignment after DOM settles on next animation frame
    if (lastEchoId) {
      await new Promise((resolve) => window.requestAnimationFrame(resolve))

      const cardEl =
        document.getElementById(`echo-${lastEchoId}`) ||
        (document.querySelector(`[data-echo-id="${lastEchoId}"]`) as HTMLElement | null)

      if (cardEl) {
        let targetTop: number | null = null
        if (savedViewportTop !== null && Number.isFinite(savedViewportTop)) {
          targetTop = savedViewportTop
        } else if (savedViewportRatio !== null && Number.isFinite(savedViewportRatio)) {
          const vh = window.innerHeight || document.documentElement.clientHeight || 1
          targetTop = Math.round(savedViewportRatio * vh)
        }

        if (targetTop !== null) {
          const currentRect = cardEl.getBoundingClientRect()
          const delta = Math.round(currentRect.top - targetTop)
          // Avoid layout thrashing: only adjust for small layout shifts (between 6px and 120px)
          if (Math.abs(delta) >= 6 && Math.abs(delta) <= 120) {
            if (isDesktop && mainColumn.value) {
              mainColumn.value.scrollTop += delta
            } else if (typeof window !== 'undefined') {
              window.scrollBy({ top: delta, behavior: 'instant' as ScrollBehavior })
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ScrollRestore] Error restoring scroll position:', err)
  } finally {
    // Clean up one-time card alignment keys so future tab-switches or navigations
    // don't mistakenly jump back to an old card
    sessionStg.removeItem(LAST_ACTIVE_ECHO_KEY)
    sessionStg.removeItem(LAST_ACTIVE_VIEWPORT_TOP_KEY)
    sessionStg.removeItem(LAST_ACTIVE_VIEWPORT_RATIO_KEY)
    window.setTimeout(() => {
      isRestoringScroll.value = false
    }, 100)
  }
}

const prefetchHeavyChunks = () => {
  const trigger = () => {
    import('@/views/echo/EchoView.vue').catch(() => {})
    import('@/editor/core/markdown').catch(() => {})
  }
  const ric = (window as Window & { requestIdleCallback?: typeof requestIdleCallback })
    .requestIdleCallback
  if (typeof ric === 'function') {
    ric(trigger, { timeout: 2000 })
  } else {
    window.setTimeout(trigger, 1500)
  }
}

watch(activeTab, (tab, prevTab) => {
  if (tab === 'home' && prevTab !== 'home') {
    void restoreTimelineScrollPosition()
  } else if (prevTab === 'home' && tab !== 'home') {
    if (!isRestoringScroll.value) {
      flushScrollPositions()
    }
  }
})

onBeforeRouteLeave(() => {
  if (!isRestoringScroll.value) {
    flushScrollPositions()
  }
  isNavigatingAway.value = true
})

onMounted(async () => {
  if (mainColumn.value) {
    mainColumn.value.scrollLeft = 0
  }
  bindScrollListeners()
  const stopScrollRestoreWatch = watch(
    () => echoStore.echoList.length > 0 && !echoStore.isLoading,
    (ready) => {
      if (!ready) return
      stopScrollRestoreWatch()
      window.requestAnimationFrame(() => {
        void restoreTimelineScrollPosition()
      })
    },
    { immediate: true, flush: 'post' },
  )
  window.addEventListener('keydown', handleGlobalKeydown)
  prefetchHeavyChunks()
})

onDeactivated(() => {
  if (!isRestoringScroll.value) {
    flushScrollPositions()
  }
  isNavigatingAway.value = true
  unbindScrollListeners()
  window.removeEventListener('keydown', handleGlobalKeydown)
})

onActivated(() => {
  isNavigatingAway.value = false
  window.addEventListener('keydown', handleGlobalKeydown)
  void restoreTimelineScrollPosition().finally(() => {
    bindScrollListeners()
  })
})

onBeforeUnmount(() => {
  unbindScrollListeners()
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.home-page {
  --home-canvas: var(--color-bg-canvas, #f5f3ef);
  --home-accent: #e07020;
  --home-main-max: 28rem;

  min-height: 100dvh;
  background: var(--home-canvas);
  color: var(--color-text-primary);
}

@media (width >= 820px) {
  .home-page {
    height: 100dvh;
    overflow: hidden;
  }
}

.home-shell {
  max-width: 50rem;
  margin: 1rem auto 2.5rem;
  padding: 0 0.75rem;
}

@media (width >= 640px) {
  .home-shell {
    margin-top: 1.25rem;
    margin-bottom: 2rem;
    padding: 0 1rem;
  }
}

@media (width >= 820px) {
  .home-shell {
    margin: 0 auto;
    padding: 0 1rem;
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}

.home-layout {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: stretch;
  background: transparent;
}

@media (width >= 820px) {
  .home-layout {
    flex: 1;
    min-height: 0;
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    gap: clamp(1.25rem, 4vw, 2rem);
    padding: 0;
  }
}

.home-main-track {
  width: 100%;
  max-width: var(--home-main-max);
  margin-left: auto;
  margin-right: auto;
}

@media (width <= 819px) {
  .home-main-track {
    max-width: 100%;
  }
}

.home-main {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
  overflow-x: visible;
}

@media (width >= 820px) {
  .home-main {
    min-height: 0;
    align-self: stretch;
    overflow-y: auto;
    scrollbar-gutter: stable;
    overscroll-behavior: contain;
    flex: 0 1 var(--home-main-max);
    max-width: var(--home-main-max);
    padding: 1.5rem 0 2rem;
  }

  .home-main--unclipped {
    overflow: visible auto;
  }
}

.home-aside {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  width: 100%;
}

.home-aside__filter-block {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.home-aside__version {
  display: inline-block;
  margin: 0;
  margin-top: 0.5rem;
  padding-inline: 0.5rem;
  font-family: var(--font-family-display);
  font-weight: 600;
  font-size: 0.75rem;
  line-height: 1.25;
  letter-spacing: 0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
  text-decoration: none;
}

.home-content-block {
  width: 100%;
}

.home-content-block--publish {
  padding-inline: 0;
}

.home-status-widgets {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

@media (width >= 768px) {
  .home-content-block--publish {
    padding-inline: 1.75rem;
  }
}

@media (width >= 1024px) {
  .home-content-block--publish {
    padding-inline: 2rem;
  }
}

.home-aside--mobile {
  display: flex;
  margin-top: 0.2rem;
  margin-bottom: 0.75rem;
}

@media (width >= 820px) {
  .home-aside--mobile {
    display: none !important;
  }

  .home-aside--rail {
    display: flex;
    width: 14rem;
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 1.5rem;
  }
}

@media (width <= 819px) {
  .home-banner--mobile-hidden {
    display: none;
  }

  .home-aside--rail {
    display: none !important;
  }
}
</style>
