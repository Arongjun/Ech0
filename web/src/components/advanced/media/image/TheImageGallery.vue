<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div v-if="displayImages.length" class="image-gallery-container">
    <GalleryWaterfall
      v-if="layoutValue === ImageLayout.WATERFALL"
      :images="displayImages"
      :resolved-srcs="resolvedSrcs"
      :get-alt="getAlt"
      :get-image-key="getImageKey"
      :is-loaded="isImageLoaded"
      :mark-loaded="markImageLoaded"
      :open="openGallery"
      :get-aspect-ratio-style="getAspectRatioStyle"
      :priority="props.priority"
    />

    <GalleryGrid
      v-if="layoutValue === ImageLayout.GRID"
      :images="displayImages"
      :resolved-srcs="resolvedSrcs"
      :get-alt="getAlt"
      :get-image-key="getImageKey"
      :is-loaded="isImageLoaded"
      :mark-loaded="markImageLoaded"
      :open="openGallery"
      :priority="props.priority"
    />

    <GalleryCarousel
      v-if="layoutValue === ImageLayout.CAROUSEL"
      :images="displayImages"
      :resolved-srcs="resolvedSrcs"
      :get-alt="getAlt"
      :is-loaded="isImageLoaded"
      :mark-loaded="markImageLoaded"
      :open="openGallery"
      :get-aspect-ratio-style="getAspectRatioStyle"
      :priority="props.priority"
    />

    <GalleryHorizontal
      v-if="layoutValue === ImageLayout.HORIZONTAL"
      :images="displayImages"
      :resolved-srcs="resolvedSrcs"
      :scroll-hint-text="t('imageGallery.scrollHint')"
      :get-alt="getAlt"
      :get-image-key="getImageKey"
      :is-loaded="isImageLoaded"
      :mark-loaded="markImageLoaded"
      :open="openGallery"
      :get-horizontal-aspect-style="getHorizontalAspectStyle"
      :priority="props.priority"
    />

    <GalleryStack
      v-if="layoutValue === ImageLayout.STACK"
      :images="displayImages"
      :resolved-srcs="resolvedSrcs"
      :get-alt="getAlt"
      :get-image-key="getImageKey"
      :is-loaded="isImageLoaded"
      :mark-loaded="markImageLoaded"
      :open="openGallery"
      :priority="props.priority"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getImageUrl, getHubImageUrl } from '@/utils/other'
import { ImageLayout } from '@/enums/enums'
import { useI18n } from 'vue-i18n'
import { useMediaFancybox } from '@/composables/useMediaFancybox'
import { pairEchoFiles } from '@/utils/livephoto'
import { getHubFileUrl, getFileUrl } from '@/utils/other'
import GalleryWaterfall from './layouts/GalleryWaterfall.vue'
import GalleryGrid from './layouts/GalleryGrid.vue'
import GalleryCarousel from './layouts/GalleryCarousel.vue'
import GalleryHorizontal from './layouts/GalleryHorizontal.vue'
import GalleryStack from './layouts/GalleryStack.vue'

const props = withDefaults(
  defineProps<{
    images?: App.Api.Ech0.FileObject[]
    baseUrl?: string
    layout?: ImageLayout | string | undefined
    priority?: boolean
  }>(),
  { priority: false },
)

const { t } = useI18n()

const pairedResult = computed(() => {
  const raw = props.images || []
  if (raw.length === 0)
    return { imageFiles: [], videoFiles: [], audioFiles: [], hasLivePhoto: false }
  if (raw.some((img) => img.is_live_photo && img.live_video_url)) {
    return {
      imageFiles: raw,
      videoFiles: [],
      audioFiles: [],
      hasLivePhoto: true,
    }
  }
  return pairEchoFiles(raw, (video) =>
    props.baseUrl ? getHubFileUrl(video, props.baseUrl) : getFileUrl(video),
  )
})

const displayImages = computed(() => pairedResult.value.imageFiles)
const isValidLayout = (layout?: ImageLayout | string): layout is ImageLayout => {
  if (!layout) return false
  return (Object.values(ImageLayout) as string[]).includes(layout)
}

const layoutValue = computed(() =>
  isValidLayout(props.layout) ? props.layout : ImageLayout.WATERFALL,
)
const loadedImages = ref<Record<string, boolean>>({})
const resolvedSrcs = computed(() =>
  displayImages.value.map((image) =>
    props.baseUrl ? getHubImageUrl(image, props.baseUrl) : getImageUrl(image),
  ),
)

const galleryItems = computed(() =>
  displayImages.value.map((image, idx) => ({
    src: resolvedSrcs.value[idx] || '',
    thumb: resolvedSrcs.value[idx] || '',
    width: image.width,
    height: image.height,
    alt: getAlt(idx),
    isLivePhoto: Boolean(image.is_live_photo || image.live_video_url),
    videoSrc: image.live_video_url || '',
  })),
)

const { open: openGalleryMedia } = useMediaFancybox(galleryItems)

const getAlt = (idx: number) => t('imageGallery.previewImage', { index: idx + 1 })

const openGallery = (index: number, sourceElement?: HTMLElement | null) => {
  openGalleryMedia(index, sourceElement)
}

const getImageKey = (image: App.Api.Ech0.FileObject, idx: number) =>
  image.id || `${image.url}-${idx}`

const FALLBACK_ASPECT_RATIO = '4 / 3'

const getAspectRatioStyle = (
  image: App.Api.Ech0.FileObject,
  loaded: boolean,
): Record<string, string> | undefined => {
  if (image.width && image.height) return { aspectRatio: `${image.width} / ${image.height}` }
  if (loaded) return undefined
  return { aspectRatio: FALLBACK_ASPECT_RATIO }
}

const getHorizontalAspectStyle = (
  image: App.Api.Ech0.FileObject,
  loaded: boolean,
): Record<string, string> | undefined => {
  if (image.width && image.height) {
    return { aspectRatio: `${image.width} / ${image.height}`, width: 'auto' }
  }
  if (loaded) return undefined
  return { aspectRatio: FALLBACK_ASPECT_RATIO, width: 'auto' }
}

const isImageLoaded = (image: App.Api.Ech0.FileObject, idx: number) =>
  Boolean(loadedImages.value[getImageKey(image, idx)])

const markImageLoaded = (image: App.Api.Ech0.FileObject, idx: number) => {
  loadedImages.value[getImageKey(image, idx)] = true
}

watch(
  displayImages,
  (nextImages) => {
    const nextKeys = new Set(nextImages.map((image, idx) => getImageKey(image, idx)))
    const nextLoadedMap: Record<string, boolean> = {}

    Object.keys(loadedImages.value).forEach((key) => {
      if (nextKeys.has(key)) {
        nextLoadedMap[key] = true
      }
    })

    loadedImages.value = nextLoadedMap
  },
  { immediate: true },
)
</script>

<style scoped>
.image-gallery-container {
  position: relative;
}
</style>
