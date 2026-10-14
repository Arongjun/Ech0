<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="echo-meta">
    <div v-if="tags.length > 0" class="echo-meta-tags">
      <button
        v-for="tag in tags"
        :key="tag.id || tag.name"
        type="button"
        class="echo-meta-chip cursor-pointer"
        v-tooltip="t('homeSidebar.tags')"
        :aria-label="tag.name"
        @click.stop="handleTagClick(tag)"
      >
        #{{ tag.name }}
      </button>
    </div>

    <div class="echo-meta-line">
      <button
        type="button"
        class="echo-meta-item cursor-pointer hover:underline bg-transparent border-0 p-0 text-inherit focus:outline-none"
        @click.stop="toggleTimeDisplay"
        v-tooltip="t('echoCard.toggleTimeFormat')"
        :aria-label="t('echoCard.toggleTimeFormat')"
      >
        <time :datetime="String(props.echo.created_at)">
          {{ formatDisplayTime(props.echo.created_at) }}
        </time>
      </button>
      <span class="echo-meta-dot" aria-hidden="true">·</span>
      <span class="echo-meta-item">
        {{ t('echoDetail.metaWordCountValue', { count: wordCount }) }}
      </span>
      <span v-if="props.echo.private" class="echo-meta-dot" aria-hidden="true">·</span>
      <span v-if="props.echo.private" class="echo-meta-item echo-meta-item--lock">
        <Lock class="w-3 h-3" />
        {{ t('echoDetail.metaPrivate') }}
      </span>
      <div class="echo-meta-actions">
        <TheShareEchoPanel :echo-id="props.echo.id" :echo-content="props.echo.content" />
        <button
          type="button"
          class="echo-meta-like"
          v-tooltip="t('echoDetail.like')"
          @click="handleLikeEcho(props.echo.id)"
        >
          <span
            :class="[
              'transform transition-transform duration-150 inline-flex',
              isLikeAnimating ? 'scale-160' : 'scale-100',
            ]"
          >
            <GrayLike class="w-4 h-4" />
          </span>
          <span class="text-xs text-[var(--color-text-muted)]">
            {{ props.echo.fav_count > 99 ? '99+' : props.echo.fav_count }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Lock from '@/components/icons/lock.vue'
import GrayLike from '@/components/icons/graylike.vue'
import TheShareEchoPanel from '@/components/advanced/echo/cards/TheShareEchoPanel.vue'
import { useTimeDisplay } from '@/composables/useTimeDisplay'
import { countWords } from '@/utils/echo'
import { fetchLikeEcho } from '@/service/api'
import { theToast } from '@/utils/toast'
import { localStg } from '@/utils/storage'
import { isStaticMode } from '@/service/request/shared'
import { useEchoStore } from '@/stores'

const { t } = useI18n()
const { toggleTimeDisplay, formatDisplayTime } = useTimeDisplay()
const router = useRouter()
const echoStore = useEchoStore()

const props = defineProps<{
  echo: App.Api.Ech0.Echo
}>()

const emit = defineEmits<{
  (e: 'updateLikeCount', echoId: string): void
}>()

type NormalizedTag = { id: string; name: string }

const wordCount = computed(() => countWords(props.echo.content))

const tags = computed<NormalizedTag[]>(() => {
  const result: NormalizedTag[] = []
  const seen = new Set<string>()

  const addTag = (name: unknown, id?: unknown) => {
    const cleanName = String(name || '').trim().replace(/^#+/, '')
    if (cleanName && !seen.has(cleanName)) {
      seen.add(cleanName)
      result.push({
        id: id ? String(id) : cleanName,
        name: cleanName,
      })
    }
  }

  // 1. From props.echo.tags
  if (Array.isArray(props.echo.tags)) {
    for (const item of props.echo.tags) {
      if (!item) continue
      if (typeof item === 'string') {
        addTag(item)
      } else if (typeof item === 'object') {
        addTag(item.name, item.id)
      }
    }
  }

  // 2. Fallback / supplement: extract hashtags from content if any (#tag)
  if (props.echo.content) {
    const matches = props.echo.content.matchAll(/(?:^|[\s，。！？,!?])#([^\s#，。！？,!?]+)/g)
    for (const match of matches) {
      if (match[1]) {
        addTag(match[1])
      }
    }
  }

  return result
})

const handleTagClick = (tag: NormalizedTag) => {
  if (!tag) return
  const matched = echoStore.tagList.find(
    (t) => t.id === tag.id || t.name === tag.name || t.name === `#${tag.name}`,
  ) || {
    id: tag.id,
    name: tag.name,
    usage_count: 1,
    created_at: Date.now(),
  }
  echoStore.filteredTag = matched
  echoStore.isFilteringMode = true
  echoStore.refreshEchos()
  router.push({ name: 'home' })
}

const isLikeAnimating = ref(false)

const LIKE_LIST_KEY = 'likedEchoIds'
const likedEchoIds: string[] = localStg.getItem(LIKE_LIST_KEY) || []
const hasLikedEcho = (echoId: string): boolean => likedEchoIds.includes(echoId)

const handleLikeEcho = (echoId: string) => {
  isLikeAnimating.value = true
  setTimeout(() => {
    isLikeAnimating.value = false
  }, 250)

  if (isStaticMode()) {
    theToast.info(String(t('staticSite.likeUnavailable')))
    return
  }

  if (hasLikedEcho(echoId)) {
    theToast.info(String(t('echoDetail.alreadyLiked')))
    return
  }

  fetchLikeEcho(echoId).then((res) => {
    if (res.code === 1) {
      likedEchoIds.push(echoId)
      localStg.setItem(LIKE_LIST_KEY, likedEchoIds)
      emit('updateLikeCount', echoId)
      theToast.info(String(t('echoDetail.likeSuccess')))
    }
  })
}
</script>

<style scoped>
.echo-meta {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.75rem 0 0;
}

.echo-meta-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text-muted);
  font-family: var(--font-family-mono);
  font-size: 0.75rem;
  letter-spacing: 0.02em;
}

.echo-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.echo-meta-item--lock {
  color: var(--color-text-secondary);
}

.echo-meta-dot {
  color: var(--color-border-strong);
}

.echo-meta-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
}

.echo-meta-chip {
  display: inline-flex;
  align-items: center;
  border: 1px dashed var(--color-border-subtle);
  border-radius: var(--radius-sm);
  padding: 0.15rem 0.55rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  line-height: 1.35;
  background: transparent;
  cursor: pointer;
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    background-color 0.18s ease;
}

.echo-meta-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-bg-muted);
}

.echo-meta-actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.echo-meta-like {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
}
</style>
