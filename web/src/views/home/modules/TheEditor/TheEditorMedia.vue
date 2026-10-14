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

      <!-- Multi-Image Grid Layout with Drag & Drop Reordering -->
      <div v-else class="w-full">
        <div
          class="grid gap-2.5 sm:gap-3"
          :class="filesToAdd.length === 2 ? 'grid-cols-2' : 'grid-cols-3'"
        >
          <div
            v-for="(file, idx) in filesToAdd"
            :key="file.id || idx"
            class="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-subtle)] bg-[var(--color-bg-muted)] shadow-xs group cursor-grab active:cursor-grabbing transition-all duration-150 select-none"
            :class="[
              draggedIdx === idx
                ? 'opacity-40 scale-95 ring-2 ring-[var(--color-border-strong)]'
                : '',
              dragOverIdx === idx && draggedIdx !== idx
                ? 'ring-2 ring-[var(--color-accent)] ring-offset-2 scale-[1.02]'
                : '',
            ]"
            draggable="true"
            @dragstart="onDragStart(idx, $event)"
            @dragenter.prevent="onDragEnter(idx)"
            @dragover.prevent="onDragOver(idx, $event)"
            @dragleave="onDragLeave(idx)"
            @drop.prevent="onDrop(idx)"
            @dragend="onDragEnd"
          >
            <!-- Thumbnail Image -->
            <button
              type="button"
              class="w-full h-full p-0 border-0 bg-transparent cursor-zoom-in overflow-hidden block"
              @click="openPreview(idx)"
            >
              <img
                :src="getImageToAddUrl(file)"
                alt="Image"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
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
        </div>

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
import { useMediaFancybox } from '@/composables/useMediaFancybox'

const { openConfirm } = useBaseDialog()
const { t } = useI18n()

const isDeleting = ref<boolean>(false)
const draggedIdx = ref<number | null>(null)
const dragOverIdx = ref<number | null>(null)

const echoStore = useEchoStore()
const { echoToUpdate } = storeToRefs(echoStore)
const editorStore = useEditorStore()
const { filesToAdd, currentMode, isUpdateMode, mediaCategory } = storeToRefs(editorStore)

const previewItems = computed(() =>
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
const { open: openPreview } = useMediaFancybox(previewItems)

const isAudio = computed(() => mediaCategory.value === FILE_CATEGORY.AUDIO)
const isVideo = computed(() => mediaCategory.value === FILE_CATEGORY.VIDEO)
const isImage = computed(() => !isAudio.value && !isVideo.value)

const mediaFiles = computed<App.Api.Ech0.FileObject[]>(() =>
  filesToAdd.value.map((file) => ({ ...file, id: file.id ?? '', echo_id: '' })),
)

const onDragStart = (idx: number, e: DragEvent) => {
  draggedIdx.value = idx
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
}

const onDragEnter = (idx: number) => {
  if (draggedIdx.value !== null && draggedIdx.value !== idx) {
    dragOverIdx.value = idx
  }
}

const onDragOver = (idx: number, e: DragEvent) => {
  if (draggedIdx.value !== null && draggedIdx.value !== idx) {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    dragOverIdx.value = idx
  }
}

const onDragLeave = (idx: number) => {
  if (dragOverIdx.value === idx) {
    dragOverIdx.value = null
  }
}

const onDrop = (targetIdx: number) => {
  if (draggedIdx.value === null || draggedIdx.value === targetIdx) {
    draggedIdx.value = null
    dragOverIdx.value = null
    return
  }

  const list = [...filesToAdd.value]
  const [moved] = list.splice(draggedIdx.value, 1)
  list.splice(targetIdx, 0, moved)
  editorStore.setFilesToAdd(list)

  if (isUpdateMode.value && echoToUpdate.value) {
    void editorStore.handleAddOrUpdateEcho(true)
  }

  draggedIdx.value = null
  dragOverIdx.value = null
}

const onDragEnd = () => {
  draggedIdx.value = null
  dragOverIdx.value = null
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

<style scoped></style>
