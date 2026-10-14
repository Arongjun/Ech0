// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { ref, watch, type Ref } from 'vue'
import { ImageLayout } from '@/enums/enums'
import { localStg } from '@/utils/storage'
import { theToast } from '@/utils/toast'
import { useBaseDialog } from '@/composables/useBaseDialog'
import type {
  EditorDraft,
  ExtensionToAdd,
  LocationToAdd,
  Translate,
  TweetToAdd,
  WebsiteToAdd,
} from './types'

const EDITOR_DRAFT_STORAGE_KEY = 'editor_echo_draft_v1'
const EDITOR_DRAFT_TTL_MS = 24 * 60 * 60 * 1000
const EDITOR_DRAFT_SAVE_DEBOUNCE_MS = 600

type DraftModuleDeps = {
  echoToAdd: Ref<App.Api.Ech0.EchoToAdd>
  filesToAdd: Ref<App.Api.Ech0.FileToAdd[]>
  websiteToAdd: Ref<WebsiteToAdd>
  videoURL: Ref<string>
  musicURL: Ref<string>
  githubRepo: Ref<string>
  extensionToAdd: Ref<ExtensionToAdd>
  locationToAdd: Ref<LocationToAdd>
  tweetToAdd: Ref<TweetToAdd>
  tagToAdd: Ref<string[]>
  isUpdateMode: Ref<boolean>
  resetAttachments: (files: App.Api.Ech0.FileToAdd[]) => void
  t: Translate
}

export function useDraftModule(deps: DraftModuleDeps) {
  const {
    echoToAdd,
    filesToAdd,
    websiteToAdd,
    videoURL,
    musicURL,
    githubRepo,
    extensionToAdd,
    locationToAdd,
    tweetToAdd,
    tagToAdd,
    isUpdateMode,
    resetAttachments,
    t,
  } = deps

  const { openConfirm } = useBaseDialog()

  const isRestoringDraft = ref<boolean>(false)
  const hasPromptedDraft = ref<boolean>(false)
  const hasBoundDraftFlushListeners = ref<boolean>(false)
  let draftTimer: ReturnType<typeof setTimeout> | null = null

  const clearLocalDraft = () => {
    localStg.removeItem(EDITOR_DRAFT_STORAGE_KEY)
    hasPromptedDraft.value = false
  }

  const hasDraftContent = () => {
    const hasText = !!echoToAdd.value.content?.trim()
    const hasTag = Array.isArray(tagToAdd.value) && tagToAdd.value.length > 0
    const hasFiles = filesToAdd.value.length > 0
    const hasWebsiteInput = !!websiteToAdd.value.title.trim() || !!websiteToAdd.value.site.trim()
    const hasExtInput =
      !!extensionToAdd.value.extension?.trim() ||
      !!extensionToAdd.value.extension_type ||
      !!videoURL.value.trim() ||
      !!musicURL.value.trim() ||
      !!githubRepo.value.trim()
    const hasLocationInput =
      locationToAdd.value.latitude !== null ||
      locationToAdd.value.longitude !== null ||
      !!locationToAdd.value.placeholder.trim()
    const hasTweetInput = !!tweetToAdd.value.url?.trim()

    return (
      hasText ||
      hasTag ||
      hasFiles ||
      hasWebsiteInput ||
      hasExtInput ||
      hasLocationInput ||
      hasTweetInput
    )
  }

  const saveDraftNow = () => {
    if (isRestoringDraft.value || isUpdateMode.value) return
    if (!hasDraftContent()) {
      clearLocalDraft()
      return
    }

    const draft: EditorDraft = {
      savedAt: Date.now(),
      echoToAdd: {
        content: echoToAdd.value.content || '',
        private: !!echoToAdd.value.private,
        layout: echoToAdd.value.layout || ImageLayout.WATERFALL,
        extension: echoToAdd.value.extension || null,
      },
      filesToAdd: filesToAdd.value.map((file) => ({
        id: file.id,
        url: file.url || '',
        storage_type: file.storage_type,
        category: file.category,
        content_type: file.content_type,
        key: file.key,
        size: file.size,
        width: file.width,
        height: file.height,
        name: file.name,
        is_live_photo: file.is_live_photo,
        live_video_id: file.live_video_id,
        live_video_url: file.live_video_url,
        live_pair_id: file.live_pair_id,
      })),
      websiteToAdd: {
        title: websiteToAdd.value.title || '',
        site: websiteToAdd.value.site || '',
      },
      videoURL: videoURL.value || '',
      musicURL: musicURL.value || '',
      githubRepo: githubRepo.value || '',
      extensionToAdd: {
        extension: extensionToAdd.value.extension || '',
        extension_type: extensionToAdd.value.extension_type || '',
      },
      locationToAdd: {
        latitude: locationToAdd.value.latitude,
        longitude: locationToAdd.value.longitude,
        placeholder: locationToAdd.value.placeholder || '',
      },
      tweetToAdd: {
        url: tweetToAdd.value.url || '',
        username: tweetToAdd.value.username || '',
        statusId: tweetToAdd.value.statusId || '',
      },
      tagToAdd: Array.isArray(tagToAdd.value) ? [...tagToAdd.value] : [],
    }
    localStg.setItem(EDITOR_DRAFT_STORAGE_KEY, draft)
  }

  const scheduleSaveDraft = () => {
    if (draftTimer) clearTimeout(draftTimer)
    draftTimer = setTimeout(() => {
      saveDraftNow()
    }, EDITOR_DRAFT_SAVE_DEBOUNCE_MS)
  }

  const flushDraftOnPageLeave = () => {
    saveDraftNow()
  }

  const restoreDraftIfNeeded = () => {
    if (isRestoringDraft.value || isUpdateMode.value || hasPromptedDraft.value) return
    if (hasDraftContent()) return

    const draft = localStg.getItem<EditorDraft>(EDITOR_DRAFT_STORAGE_KEY)
    if (!draft) return
    if (typeof draft.savedAt !== 'number' || Date.now() - draft.savedAt > EDITOR_DRAFT_TTL_MS) {
      clearLocalDraft()
      return
    }

    const rawTitle = t('editor.restoreDraftTitle')
    const titleText =
      rawTitle && rawTitle !== 'editor.restoreDraftTitle' ? rawTitle : '恢复本地草稿'

    const rawDesc = t('editor.restoreDraftDesc')
    const descText =
      rawDesc && rawDesc !== 'editor.restoreDraftDesc'
        ? rawDesc
        : '检测到你有未发布的本地草稿，是否恢复？'

    hasPromptedDraft.value = true

    openConfirm({
      title: titleText,
      description: descText,
      onConfirm: () => {
        isRestoringDraft.value = true
        try {
          echoToAdd.value = {
            content: draft.echoToAdd?.content || '',
            echo_files: [],
            private: !!draft.echoToAdd?.private,
            layout: draft.echoToAdd?.layout || ImageLayout.WATERFALL,
            extension: draft.echoToAdd?.extension || null,
            tags: [],
          }
          resetAttachments(draft.filesToAdd || [])
          websiteToAdd.value = {
            title: draft.websiteToAdd?.title || '',
            site: draft.websiteToAdd?.site || '',
          }
          videoURL.value = draft.videoURL || ''
          musicURL.value = draft.musicURL || ''
          githubRepo.value = draft.githubRepo || ''
          extensionToAdd.value = {
            extension: draft.extensionToAdd?.extension || '',
            extension_type: draft.extensionToAdd?.extension_type || '',
          }
          locationToAdd.value = {
            latitude:
              typeof draft.locationToAdd?.latitude === 'number'
                ? draft.locationToAdd.latitude
                : null,
            longitude:
              typeof draft.locationToAdd?.longitude === 'number'
                ? draft.locationToAdd.longitude
                : null,
            placeholder: draft.locationToAdd?.placeholder || '',
          }
          tweetToAdd.value = {
            url: draft.tweetToAdd?.url || '',
            username: draft.tweetToAdd?.username || '',
            statusId: draft.tweetToAdd?.statusId || '',
          }
          tagToAdd.value = Array.isArray(draft.tagToAdd) ? [...draft.tagToAdd] : []

          const rawRecovered = t('editor.restoreDraftRecovered')
          const recoveredText =
            rawRecovered && rawRecovered !== 'editor.restoreDraftRecovered'
              ? rawRecovered
              : '已恢复本地草稿'
          theToast.info(recoveredText)
        } finally {
          isRestoringDraft.value = false
        }
      },
      onCancel: () => {
        clearLocalDraft()
      },
    })
  }

  const initDraftWatchers = () => {
    watch(
      [
        echoToAdd,
        filesToAdd,
        websiteToAdd,
        videoURL,
        musicURL,
        githubRepo,
        extensionToAdd,
        locationToAdd,
        tweetToAdd,
        tagToAdd,
        isUpdateMode,
      ],
      () => {
        scheduleSaveDraft()
      },
      { deep: true },
    )
  }

  const initDraftLifecycle = () => {
    if (!hasBoundDraftFlushListeners.value) {
      window.addEventListener('pagehide', flushDraftOnPageLeave)
      window.addEventListener('beforeunload', flushDraftOnPageLeave)
      hasBoundDraftFlushListeners.value = true
    }
  }

  return {
    isRestoringDraft,
    clearLocalDraft,
    hasDraftContent,
    saveDraftNow,
    scheduleSaveDraft,
    flushDraftOnPageLeave,
    restoreDraftIfNeeded,
    initDraftWatchers,
    initDraftLifecycle,
  }
}
