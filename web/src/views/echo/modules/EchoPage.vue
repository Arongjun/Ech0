<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="echo-page home-page">
    <div class="home-shell">
      <div class="home-layout">
        <div ref="mainColumn" class="home-main">
          <div class="home-main-track">
            <!-- Mobile nav row matching HomePage -->
            <aside class="home-aside home-aside--mobile">
              <HomeSidebarNav
                v-model:mobile-search-open="mobileSearchOpen"
                @open-palette="paletteOpen = true"
                @open-chat="chatLauncherOpen = true"
              />
            </aside>

            <div v-if="echo" class="echo-detail-container">
              <TheEchoDetail :echo="echo" @update-like-count="handleUpdateLikeCount" />
              <TheEchoInteractions />
            </div>
            <div v-else class="text-[var(--color-text-muted)] py-16 text-center">
              <p>{{ t('echoPage.loadingDetail') }}</p>
            </div>
          </div>
        </div>

        <!-- Desktop Sidebar Rail matching HomePage exactly -->
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
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import TheEchoDetail from '@/components/advanced/echo/cards/TheEchoDetail.vue'
import TheEchoInteractions from '@/components/advanced/echo/cards/TheEchoInteractions.vue'
import HomeSidebarNav from '@/views/home/modules/HomeSidebarNav.vue'
import TheFilter from '@/views/home/modules/TheFilter.vue'
import TheCommandPalette from '@/views/home/modules/TheCommandPalette.vue'
import TheChatLauncher from '@/views/home/modules/TheChatLauncher.vue'
import { useEchoStore, useSettingStore } from '@/stores'

const route = useRoute()
const { t } = useI18n()
const echoStore = useEchoStore()
const settingStore = useSettingStore()

const echoId = route.params.echoId as string
const mainColumn = ref<HTMLElement | null>(null)
const mobileSearchOpen = ref(false)
const paletteOpen = ref(false)
const chatLauncherOpen = ref(false)

const getEchoFromStore = (id: string): App.Api.Ech0.Echo | null => {
  const targetId = String(id ?? '').trim()
  if (!targetId) return null
  const idx = echoStore.echoIndexMap.get(targetId)
  if (idx !== undefined && echoStore.echoList[idx]) {
    return echoStore.echoList[idx]
  }
  return echoStore.echoList.find((e) => String(e.id).trim() === targetId) ?? null
}

const echo = ref<App.Api.Ech0.Echo | null>(getEchoFromStore(echoId))
const isLoading = ref(!echo.value)

const handleUpdateLikeCount = () => {
  if (echo.value) {
    echo.value.fav_count += 1
  }
}

watch(
  () => route.params.echoId,
  async (newId) => {
    if (!newId) return
    const id = String(newId).trim()
    echo.value = getEchoFromStore(id)
    if (!echo.value) {
      isLoading.value = true
      echo.value = await echoStore.prefetchEcho(id)
      isLoading.value = false
    }
    if (mainColumn.value) {
      mainColumn.value.scrollTop = 0
    }
  },
)

onMounted(async () => {
  if (mainColumn.value) {
    mainColumn.value.scrollTop = 0
  }
  if (!echo.value) {
    echo.value = await echoStore.prefetchEcho(echoId)
  }
  isLoading.value = false
})
</script>

<style scoped>
.echo-page {
  --home-canvas: var(--color-bg-canvas, #f5f3ef);
  --home-accent: #e07020;
  --home-main-max: 28rem;

  min-height: 100dvh;
  background: var(--home-canvas);
  color: var(--color-text-primary);
}

@media (width >= 820px) {
  .echo-page {
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

@media (width <= 819.98px) {
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

@media (width <= 819.98px) {
  .home-aside--rail {
    display: none !important;
  }
}

.echo-detail-container {
  width: 100%;
}
</style>
