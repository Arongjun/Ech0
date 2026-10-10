<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="zen-echo-card relative w-full h-auto p-3.5 sm:p-4">
    <div class="flex flex-row items-center justify-between gap-2 mt-1 mb-3">
      <div class="flex flex-row items-center gap-2 min-w-0">
        <div class="flex-none">
          <img
            :src="avatarUrl"
            alt=""
            loading="lazy"
            decoding="async"
            class="w-6 h-6 sm:w-7 sm:h-7 rounded-full ring-1 ring-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] object-cover"
          />
        </div>
        <div class="flex items-center gap-1 min-w-0">
          <h2
            class="text-[var(--color-text-primary)] font-bold overflow-hidden whitespace-nowrap truncate"
          >
            {{ siteName }}
          </h2>
        </div>
      </div>

      <div class="flex flex-none items-center gap-1.5">
        <Lock
          v-if="echo.private"
          class="w-4 h-4 sm:w-[1.125rem] sm:h-[1.125rem] text-[var(--color-text-muted)]"
        />
        <button
          type="button"
          v-tooltip="t('zenMode.openDetail')"
          :aria-label="t('zenMode.openDetail')"
          class="zen-open-btn flex items-center justify-center w-7 h-7 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border-subtle)] transition-all"
          @click="goDetail"
        >
          <Linkto class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <div class="zen-echo-body py-1.5">
      <template v-if="isContentLeadingEcho(echo)">
        <div v-if="echo.content" class="mb-2.5">
          <TheMdPreview :content="echo.content" />
        </div>

        <TheMediaPlayer :echo="echo" :layout="echo.layout" />
      </template>

      <template v-else>
        <TheMediaPlayer :echo="echo" :layout="echo.layout" />

        <div v-if="echo.content" :class="hasMedia ? 'mt-2.5' : ''">
          <TheMdPreview :content="echo.content" />
        </div>
      </template>
    </div>

    <div class="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-subtle)]/40">
      <div class="min-w-0 truncate whitespace-nowrap text-xs text-[var(--color-text-muted)] font-medium">
        {{ formatDate(echo.created_at) }}
      </div>
      <div v-if="echo.tags && echo.tags.length > 0" class="flex items-center gap-1.5 flex-wrap justify-end">
        <span
          v-for="tag in echo.tags.slice(0, 3)"
          :key="tag.id"
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]"
        >
          #{{ tag.name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { TheMdPreview } from '@/components/advanced/md'
import Lock from '@/components/icons/lock.vue'
import Linkto from '@/components/icons/linkto.vue'
import { useSettingStore } from '@/stores'
import { resolveAvatarUrl } from '@/service/request/shared'
import { formatDate } from '@/utils/other'
import { getEchoFilesBy, isContentLeadingEcho } from '@/utils/echo'

const { t } = useI18n()

const TheMediaPlayer = defineAsyncComponent(
  () => import('@/components/advanced/media/TheMediaPlayer.vue'),
)

const props = defineProps<{
  echo: App.Api.Ech0.Echo
  index?: number
}>()

const router = useRouter()
const settingStore = useSettingStore()
const { SystemSetting } = storeToRefs(settingStore)

const siteName = computed(() => String(SystemSetting.value?.server_name ?? 'Ech0'))
const avatarUrl = computed(() => resolveAvatarUrl(SystemSetting.value?.server_logo))
const hasMedia = computed(() => getEchoFilesBy(props.echo, { dedupeBy: 'id' }).length > 0)

const goDetail = () => {
  router.push({ name: 'echo', params: { echoId: String(props.echo.id) } })
}
</script>

<style scoped lang="css">
.zen-echo-card {
  contain: layout paint;
  position: relative;
  background: var(--color-bg-surface);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border-radius: var(--ag-radius-lg, 24px);
  border: 1px solid var(--ag-line);
  box-shadow: var(--ag-shadow);
  transition:
    transform 0.22s cubic-bezier(0.2, 0, 0, 1),
    box-shadow 0.22s ease;
}

.zen-echo-card:hover {
  transform: translateY(-2px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 14px 28px rgba(40, 48, 62, 0.08),
    0 2px 6px rgba(40, 48, 62, 0.04);
}

.zen-echo-card:active {
  transform: scale(0.99);
}

:root.dark .zen-echo-card:hover {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 16px 32px rgba(0, 0, 0, 0.3),
    0 2px 8px rgba(0, 0, 0, 0.2);
}

.zen-echo-card::before {
  content: '';
  position: absolute;
  top: 1.25rem;
  left: 0;
  width: 3px;
  height: 1.1rem;
  border-radius: 0 3px 3px 0;
  background: var(--ag-blue, var(--color-accent));
  opacity: 0.9;
}

@media (width >= 640px) {
  .zen-echo-card::before {
    top: 1.375rem;
    height: 1.25rem;
  }
}

.zen-echo-body :deep(p),
.zen-echo-body :deep(li) {
  font-size: 0.9rem;
  line-height: 1.55;
}

.zen-echo-body :deep(p) {
  margin: 0 0 0.55rem;
}

.zen-echo-body :deep(p:last-child) {
  margin-bottom: 0;
}

.zen-echo-body :deep(.image-gallery-container) > div {
  width: 100%;
  margin-left: 0;
  margin-right: 0;
  margin-bottom: 0;
}
</style>
