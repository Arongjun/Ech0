<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div class="w-[88%] mx-auto mb-4">
    <div :class="['grid gap-2', gridColsClass]">
      <GalleryImageItem
        v-for="(image, idx) in displayedImages"
        :key="getImageKey(image, idx)"
        :image="image"
        :src="resolvedSrcs[idx] || ''"
        :alt="getAlt(idx)"
        :loaded="isLoaded(image, idx)"
        :priority="!!priority && idx === 0"
        :button-class="`w-full overflow-hidden relative ${isSingleItem ? singleItemColSpan : 'aspect-square'}`"
        :frame-class="isSingleItem ? 'w-full h-auto' : 'h-full'"
        :img-class="isSingleItem ? 'w-full h-auto object-contain' : 'w-full h-full object-cover'"
        @click="open(idx, $event)"
        @load="markLoaded(image, idx)"
        @error="markLoaded(image, idx)"
      >
        <div v-if="extraCount > 0 && idx === 8" class="more-overlay" aria-hidden="true">
          +{{ extraCount }}
        </div>
      </GalleryImageItem>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import GalleryImageItem from '../parts/GalleryImageItem.vue'
import type { GalleryWithImageKeyProps } from './types'

const props = defineProps<GalleryWithImageKeyProps>()

const displayedImages = computed(() => props.images.slice(0, 9))
const extraCount = computed(() => (props.images.length > 9 ? props.images.length - 9 : 0))

const isSingleItem = computed(() => displayedImages.value.length === 1)

const gridColsClass = computed(() => {
  const count = displayedImages.value.length
  if (count === 1) return 'grid-cols-3'
  if (count === 2 || count === 4) return 'grid-cols-2'
  return 'grid-cols-3'
})

const singleItemAspectType = computed(() => {
  if (!isSingleItem.value) return 'square'
  const item = displayedImages.value[0]
  const width = item?.width || 0
  const height = item?.height || 0
  if (!width || !height) return 'square'
  const ratio = width / height
  if (ratio > 1.2) return 'landscape'
  if (ratio < 0.8) return 'portrait'
  return 'square'
})

const singleItemColSpan = computed(() => {
  switch (singleItemAspectType.value) {
    case 'landscape':
      return 'col-span-3'
    case 'portrait':
      return 'col-span-1'
    default:
      return 'col-span-2'
  }
})
</script>

<style scoped>
.more-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay-strong);
  color: var(--color-gallery-overlay-text);
  font-size: 20px;
  font-weight: 600;
  border-radius: 8px;
}
</style>
