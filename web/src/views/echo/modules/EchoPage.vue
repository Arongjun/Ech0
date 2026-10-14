<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="px-3 pb-4 py-2 mt-4 sm:mt-6 mb-10 mx-auto flex justify-center items-center">
    <div class="w-full sm:max-w-lg mx-auto">
      <div v-if="echo" class="w-full sm:mt-1 mx-auto">
        <TheEchoDetail :echo="echo" @update-like-count="handleUpdateLikeCount" />
        <TheEchoInteractions />
      </div>
      <div v-else class="w-full sm:mt-1 text-[var(--color-text-muted)]">
        <p class="text-center">{{ t('echoPage.loadingDetail') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import TheEchoDetail from '@/components/advanced/echo/cards/TheEchoDetail.vue'
import TheEchoInteractions from '@/components/advanced/echo/cards/TheEchoInteractions.vue'
import { useEchoStore } from '@/stores'

const route = useRoute()
const { t } = useI18n()
const echoId = route.params.echoId as string

const echoStore = useEchoStore()
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
  },
)

onMounted(async () => {
  if (!echo.value) {
    echo.value = await echoStore.prefetchEcho(echoId)
  }
  isLoading.value = false
})
</script>
