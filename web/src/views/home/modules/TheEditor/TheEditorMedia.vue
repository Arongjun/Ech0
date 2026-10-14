<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <div
    v-if="
      filesToAdd &&
      filesToAdd.length > 0 &&
      (currentMode === Mode.ECH0 || currentMode === Mode.Media)
    "
    class="relative w-11/12 mx-auto my-7"
  >
    <!-- Single media delete button for audio / video -->
    <button
      v-if="!isImage"
      @click="handleRemoveImageAt(0)"
      :disabled="isDeleting"
      class="absolute -top-2.5 -right-2.5 z-[2] w-7 h-7 flex items-center justify-center rounded-full bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--color-danger)] hover:text-white hover:border-[var(--color-danger)] disabled:opacity-60 disabled:cursor-not-allowed"
      v-tooltip="t('editor.removeImage')"
      :aria-label="t('editor.removeImage')"
    >
      <Close color="currentColor" class="w-4 h-4" />
    </button>

    <!-- Images Section -->
    <div v-if="isImage" class="w-full">
      <!-- Single Image Layout -->
      <div
        v-if="filesToAdd.length === 1"
        class="relative rounded-lg overflow-hidden shadow-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] group"
      >
        <button
          type="button"
          class="block w-full bg-transparent border-0 p-0 cursor-zoom-in"
          @click="openPreview(0)"
        >
          <img
            :src="getImageToAddUrl(filesToAdd[0])"
            alt="Image"
            class="w-full h-auto max-h-[480px] object-cover"
            loading="lazy"
          />
        </button>
        <span
          v-if="isLivePhoto(filesToAdd[0])"
          class="absolute bottom-2.5 left-2.5 z-[2] px-2 py-0.5 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs select-none pointer-events-none leading-none inline-flex items-center gap-1"
        >
          <LivePhotoIcon class="w-3 h-3" />
          <span>LIVE</span>
        </span>
        <button
          @click.stop="handleRemoveImageAt(0)"
          :disabled="isDeleting"
          class="absolute top-2.5 right-2.5 z-[3] w-7 h-7 flex items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition-colors hover:bg-[var(--color-danger)] disabled:opacity-60 disabled:cursor-not-allowed"
          v-tooltip="t('editor.removeImage')"
          :aria-label="t('editor.removeImage')"
        >
          <Close color="currentColor" class="w-4 h-4" />
        </button>
      </div>

      <!-- Multi-Image Grid Layout with Real-time Drag & Touch Reordering -->
      <div v-else class="w-full">
        <TransitionGroup
          name="media-flip"
          tag="div"
          class="grid gap-2.5 sm:gap-3"
          :class="filesToAdd.length === 2 ? 'grid-cols-2' : 'grid-cols-3'"
        >
          <div
            v-for="(file, idx) in filesToAdd"
            :key="file.id || file.url || file.key || file.name || idx"
            :data-media-index="idx"
            class="media-item relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] shadow-xs group cursor-grab active:cursor-grabbing select-none"
            :class="[
              draggedIdx === idx
                ? 'is-dragging ring-2 ring-[var(--color-accent)]'
                : 'hover:shadow-sm',
            ]"
            draggable="true"
            @dragstart="onDragStart(idx, $event)"
            @dragover.prevent="onDragOver(idx, $event)"
            @dragend="onDragEnd"
            @touchstart.passive="onTouchStart(idx, $event)"
            @touchmove="onTouchMove($event)"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
          >
            <!-- Thumbnail Image -->
            <button
              type="button"
              class="w-full h-full p-0 border-0 bg-transparent cursor-zoom-in overflow-hidden block"
              @click="handlePreviewClick(idx, $event)"
            >
              <img
                :src="getImageToAddUrl(file)"
                alt="Image"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 pointer-events-none"
                loading="lazy"
              />
            </button>

            <!-- Sequence Number Badge -->
            <span
              class="absolute top-1.5 left-1.5 z-[2] px-1.5 py-0.5 rounded text-[10px] font-semibold bg-black/60 text-white backdrop-blur-xs select-none pointer-events-none leading-none"
            >
              {{ idx + 1 }}
            </span>

            <!-- Live Photo Badge -->
            <span
              v-if="isLivePhoto(file)"
              class="absolute bottom-1.5 left-1.5 z-[2] px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-black/60 text-white backdrop-blur-xs select-none pointer-events-none leading-none inline-flex items-center gap-1"
            >
              <LivePhotoIcon class="w-2.5 h-2.5" />
              <span>LIVE</span>
            </span>

            <!-- Remove Button -->
            <button
              type="button"
              @click.stop="handleRemoveImageAt(idx)"
              :disabled="isDeleting"
              class="absolute top-1.5 right-1.5 z-[3] w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs transition-colors hover:bg-[var(--color-danger)] disabled:opacity-60 disabled:cursor-not-allowed opacity-90 group-hover:opacity-100"
              v-tooltip="t('editor.removeImage')"
              :aria-label="t('editor.removeImage')"
            >
              <Close color="currentColor" class="w-3.5 h-3.5" />
            </button>
          </div>
        </TransitionGroup>

        <!-- Drag Reorder Hint -->
        <div
          class="mt-2.5 text-center text-xs text-[var(--color-text-muted)] flex items-center justify-center gap-1.5 select-none"
        >
          <span>{{ t('editor.dragToReorder') }}</span>
          <span>·</span>
          <span>{{ filesToAdd.length }} / 9</span>
        </div>
      </div>
    </div>

    <!-- Audio Player -->
    <TheAudioPlayer v-else-if="isAudio" :files="mediaFiles" />

    <!-- Video Player -->
    <TheVideoPlayer v-else :files="mediaFiles" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import Close from '@/components/icons/close.vue'
import LivePhotoIcon from '@/components/icons/livephoto.vue'
import TheAudioPlayer from '@/components/advanced/media/audio/TheAudioPlayer.vue'
import TheVideoPlayer from '@/components/advanced/media/video/TheVideoPlayer.vue'
import { getImageToAddUrl } from '@/utils/other'
import { isLivePhoto } from '@/utils/livephoto'
import { deleteFileById } from '@/lib/file'
import { theToast } from '@/utils/toast'
import { useEchoStore, useEditorStore } from '@/stores'
import { Mode } from '@/enums/enums'
import { FILE_CATEGORY, FILE_STORAGE_TYPE } from '@/constants/file'
import { useBaseDialog } from '@/composables/useBaseDialog'
import { useI18n } from 'vue-i18n'
import {
  usePhotoSwipeGallery,
  type PhotoSwipeItem,
} from '@/components/advanced/media/image/composables/usePhotoSwipeGallery'

const { openConfirm } = useBaseDialog()
const { t } = useI18n()

const isDeleting = ref<boolean>(false)
const draggedIdx = ref<number | null>(null)

const echoStore = useEchoStore()
const { echoToUpdate } = storeToRefs(echoStore)
const editorStore = useEditorStore()
const { filesToAdd, currentMode, isUpdateMode, mediaCategory } = storeToRefs(editorStore)

const previewItems = computed<PhotoSwipeItem[]>(() =>
  filesToAdd.value.map((image, idx) => {
    const url = getImageToAddUrl(image)
    return {
      src: url,
      thumb: url,
      width: image.width,
      height: image.height,
      alt: t('imageGallery.previewImage', { index: idx + 1 }),
      isLivePhoto: Boolean(image.is_live_photo || image.live_video_url),
      videoSrc: image.live_video_url || '',
    }
  }),
)
const { open: openPreview } = usePhotoSwipeGallery(previewItems)

const isAudio = computed(() => mediaCategory.value === FILE_CATEGORY.AUDIO)
const isVideo = computed(() => mediaCategory.value === FILE_CATEGORY.VIDEO)
const isImage = computed(() => !isAudio.value && !isVideo.value)

const mediaFiles = computed<App.Api.Ech0.FileObject[]>(() =>
  filesToAdd.value.map((file) => ({ ...file, id: file.id ?? '', echo_id: '' })),
)

const moveItem = (fromIdx: number, toIdx: number) => {
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
  if (fromIdx >= filesToAdd.value.length || toIdx >= filesToAdd.value.length) return
  const list = [...filesToAdd.value]
  const [moved] = list.splice(fromIdx, 1)
  list.splice(toIdx, 0, moved)
  editorStore.setFilesToAdd(list)
}

const onDragStart = (idx: number, e: DragEvent) => {
  draggedIdx.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
}

const onDragOver = (idx: number, e: DragEvent) => {
  if (draggedIdx.value !== null && draggedIdx.value !== idx) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    const fromIdx = draggedIdx.value
    moveItem(fromIdx, idx)
    draggedIdx.value = idx
  }
}

const onDragEnd = () => {
  draggedIdx.value = null
  if (isUpdateMode.value && echoToUpdate.value) {
    void editorStore.handleAddOrUpdateEcho(true)
  }
}

let touchStartX = 0
let touchStartY = 0
let isTouching = false
let isTouchDragging = false
let touchOriginIdx = -1
let hasTouchMoved = false

const onTouchStart = (idx: number, e: TouchEvent) => {
  if (e.touches.length !== 1) return
  const touch = e.touches[0]
  touchStartX = touch.clientX
  touchStartY = touch.clientY
  touchOriginIdx = idx
  isTouching = true
  isTouchDragging = false
  hasTouchMoved = false
}

const onTouchMove = (e: TouchEvent) => {
  if (!isTouching || e.touches.length !== 1) return
  const touch = e.touches[0]
  const dx = touch.clientX - touchStartX
  const dy = touch.clientY - touchStartY

  if (!isTouchDragging && Math.hypot(dx, dy) > 8) {
    isTouchDragging = true
    hasTouchMoved = true
    draggedIdx.value = touchOriginIdx
  }

  if (isTouchDragging) {
    if (e.cancelable) {
      e.preventDefault()
    }
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const card = el?.closest('[data-media-index]') as HTMLElement | null
    if (card && card.dataset.mediaIndex !== undefined) {
      const targetIdx = parseInt(card.dataset.mediaIndex, 10)
      if (
        !isNaN(targetIdx) &&
        draggedIdx.value !== null &&
        targetIdx !== draggedIdx.value &&
        targetIdx >= 0 &&
        targetIdx < filesToAdd.value.length
      ) {
        const fromIdx = draggedIdx.value
        moveItem(fromIdx, targetIdx)
        draggedIdx.value = targetIdx
      }
    }
  }
}

const onTouchEnd = () => {
  if (isTouchDragging) {
    draggedIdx.value = null
    isTouchDragging = false
    isTouching = false
    if (isUpdateMode.value && echoToUpdate.value) {
      void editorStore.handleAddOrUpdateEcho(true)
    }
  } else {
    isTouching = false
    isTouchDragging = false
  }
  setTimeout(() => {
    hasTouchMoved = false
  }, 120)
}

const handlePreviewClick = (idx: number, e?: MouseEvent) => {
  if (hasTouchMoved || isTouchDragging) return
  const trigger = (e?.currentTarget as HTMLElement) || null
  openPreview(idx, trigger)
}

const handleRemoveImageAt = (index: number) => {
  if (isDeleting.value) return
  if (index < 0 || index >= filesToAdd.value.length || filesToAdd.value.length === 0) {
    theToast.error(String(t('editor.invalidImageIndex')))
    return
  }

  openConfirm({
    title: String(t('editor.removeImageConfirmTitle')),
    description: '',
    onConfirm: async () => {
      if (isDeleting.value) return
      const target = filesToAdd.value[index]
      const fileId = String(target?.id || '')
      const liveVideoId = String(target?.live_video_id || '')
      const source = String(target?.storage_type || '')
      const needsRemoteDelete =
        (source === FILE_STORAGE_TYPE.LOCAL || source === FILE_STORAGE_TYPE.OBJECT) && !!fileId

      isDeleting.value = true
      try {
        if (needsRemoteDelete) {
          try {
            await deleteFileById(fileId)
            if (liveVideoId && liveVideoId !== fileId) {
              await deleteFileById(liveVideoId)
            }
          } catch {
            theToast.error(String(t('editor.removeImageRemoteFailed')))
          }
        }

        editorStore.removeFileAt(index)

        if (isUpdateMode.value && echoToUpdate.value) {
          void editorStore.handleAddOrUpdateEcho(true)
        }
      } finally {
        isDeleting.value = false
      }
    },
  })
}
</script>

<style scoped>
.media-flip-move {
  transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.media-item {
  touch-action: pan-y;
  -webkit-touch-callout: none;
  user-select: none;
}

.media-item.is-dragging {
  z-index: 30;
  opacity: 0.9;
  transform: scale(1.05);
  box-shadow:
    0 12px 24px -4px rgb(0 0 0 / 25%),
    0 4px 8px -2px rgb(0 0 0 / 20%);
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
  touch-action: none;
}
</style>
