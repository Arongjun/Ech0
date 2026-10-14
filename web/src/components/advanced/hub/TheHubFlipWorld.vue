<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="hub-flip-wrapper w-full max-w-sm mx-auto my-3 select-none">
    <div
      class="hub-flip-card relative w-full transition-transform duration-600"
      :class="{ 'is-flipped': props.worldMode === 'peer' }"
    >
      <!-- Face A: Global World (全网广场) -->
      <div
        class="hub-card-face hub-card-front w-full rounded-xl p-3.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] hover:border-amber-400/50 transition-colors"
      >
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0"
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="relative flex h-2 w-2">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"
                  />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                <h3 class="text-sm font-bold text-[var(--color-text-primary)] truncate">
                  {{ t('hub.globalWorld') }}
                </h3>
              </div>
              <p class="text-[11px] text-[var(--color-text-muted)] truncate">
                {{ t('hub.globalWorldDesc') }}
              </p>
            </div>
          </div>

          <button
            type="button"
            class="hub-flip-btn flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all shrink-0 cursor-pointer border-0"
            :title="t('hub.switchToPeer')"
            @click.stop="emit('flip')"
          >
            <svg
              class="w-3.5 h-3.5 hub-flip-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{{ t('hub.flipWorld') }}</span>
          </button>
        </div>

        <!-- Node avatars strip -->
        <div
          class="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-subtle)]/60"
        >
          <div class="flex items-center -space-x-1.5 overflow-hidden py-0.5">
            <template v-if="props.activeNodes.length > 0">
              <img
                v-for="node in visibleNodes"
                :key="node.urlKey"
                :src="node.rawLogo || '/Ech0.svg'"
                :alt="node.serverName"
                :title="node.serverName"
                class="w-5 h-5 rounded-full ring-1 ring-[var(--color-bg-surface)] object-cover bg-neutral-100 dark:bg-neutral-800"
                loading="lazy"
              />
              <span
                v-if="props.activeNodes.length > 6"
                class="w-5 h-5 rounded-full ring-1 ring-[var(--color-bg-surface)] bg-[var(--color-bg-muted)] text-[9px] font-bold text-[var(--color-text-muted)] flex items-center justify-center"
              >
                +{{ props.activeNodes.length - 6 }}
              </span>
            </template>
            <template v-else-if="props.isLoading || props.isPreparing">
              <div
                v-for="i in 4"
                :key="i"
                class="w-5 h-5 rounded-full ring-1 ring-[var(--color-bg-surface)] bg-neutral-200 dark:bg-neutral-700 animate-pulse"
              />
            </template>
          </div>

          <span class="text-[11px] font-medium text-[var(--color-text-muted)] shrink-0">
            {{ t('hub.activeNodes', { count: props.activeNodes.length }) }}
          </span>
        </div>
      </div>

      <!-- Face B: Peer World (对等连接) -->
      <div
        class="hub-card-face hub-card-back w-full rounded-xl p-3.5 bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] hover:border-emerald-400/50 transition-colors"
      >
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0"
            >
              <svg
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="relative flex h-2 w-2">
                  <span
                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"
                  />
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <h3 class="text-sm font-bold text-[var(--color-text-primary)] truncate">
                  {{ t('hub.peerWorld') }}
                </h3>
              </div>
              <p class="text-[11px] text-[var(--color-text-muted)] truncate">
                {{ t('hub.peerWorldDesc') }}
              </p>
            </div>
          </div>

          <button
            type="button"
            class="hub-flip-btn flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 active:scale-95 transition-all shrink-0 cursor-pointer border-0"
            :title="t('hub.switchToGlobal')"
            @click.stop="emit('flip')"
          >
            <svg
              class="w-3.5 h-3.5 hub-flip-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{{ t('hub.flipWorld') }}</span>
          </button>
        </div>

        <!-- Node avatars strip or empty tip -->
        <div
          class="flex items-center justify-between gap-2 pt-2 border-t border-[var(--color-border-subtle)]/60"
        >
          <div class="flex items-center -space-x-1.5 overflow-hidden py-0.5">
            <template v-if="props.activeNodes.length > 0">
              <img
                v-for="node in visibleNodes"
                :key="node.urlKey"
                :src="node.rawLogo || '/Ech0.svg'"
                :alt="node.serverName"
                :title="node.serverName"
                class="w-5 h-5 rounded-full ring-1 ring-[var(--color-bg-surface)] object-cover bg-neutral-100 dark:bg-neutral-800"
                loading="lazy"
              />
              <span
                v-if="props.activeNodes.length > 6"
                class="w-5 h-5 rounded-full ring-1 ring-[var(--color-bg-surface)] bg-[var(--color-bg-muted)] text-[9px] font-bold text-[var(--color-text-muted)] flex items-center justify-center"
              >
                +{{ props.activeNodes.length - 6 }}
              </span>
            </template>
            <template v-else>
              <span class="text-[11px] text-[var(--color-text-muted)] italic truncate">
                {{ t('hub.noPeerHint') }}
              </span>
            </template>
          </div>

          <span class="text-[11px] font-medium text-[var(--color-text-muted)] shrink-0">
            {{ t('hub.activeNodes', { count: props.activeNodes.length }) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { InstanceConnectSummary } from '@/services/hub/types'
import type { ExploreWorldMode } from '@/stores/hub'

const props = withDefaults(
  defineProps<{
    worldMode: ExploreWorldMode
    activeNodes?: InstanceConnectSummary[]
    totalNodesCount?: number
    isLoading?: boolean
    isPreparing?: boolean
  }>(),
  {
    activeNodes: () => [],
    totalNodesCount: 0,
    isLoading: false,
    isPreparing: false,
  },
)

const emit = defineEmits<{
  (e: 'flip'): void
}>()

const { t } = useI18n()

const visibleNodes = computed(() => props.activeNodes.slice(0, 6))
</script>

<style scoped>
.hub-flip-wrapper {
  perspective: 1000px;
}

.hub-flip-card {
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.34, 1.4, 0.64, 1);
}

.hub-flip-card.is-flipped {
  transform: rotateY(180deg);
}

.hub-card-face {
  backface-visibility: hidden;
}

.hub-card-back {
  position: absolute;
  inset: 0;
  transform: rotateY(180deg);
}

.hub-flip-btn:hover .hub-flip-icon {
  transform: rotate(180deg);
  transition: transform 0.5s ease;
}
</style>
