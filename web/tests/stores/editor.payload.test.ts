// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '@/stores/editor'
import { fetchAddEcho } from '@/service/api'
import { getImageSize } from '@/utils/image'
import { ExtensionType, ImageLayout } from '@/enums/enums'

vi.mock('@/service/api', () => ({
  fetchAddEcho: vi.fn(),
  fetchUpdateEcho: vi.fn(),
  fetchGetTags: vi.fn(),
  fetchGetEchoById: vi.fn(),
  fetchQueryEchos: vi.fn(),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/utils/image', () => ({ getImageSize: vi.fn(async () => ({ width: 10, height: 20 })) }))

const fetchAddEchoMock = vi.mocked(fetchAddEcho)

describe('editor submit payload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    fetchAddEchoMock.mockReset()
    fetchAddEchoMock.mockResolvedValue({ code: 0, msg: '' } as never)
  })

  it('derives the attachment order, tags and extension from one draft', async () => {
    const editorStore = useEditorStore()

    editorStore.echoToAdd.content = 'hello'
    editorStore.tagToAdd = [' one ', '', 'two']
    editorStore.setFilesToAdd([
      {
        id: 'file-b',
        url: 'https://example.test/b.png',
        storage_type: 'local',
        category: 'image',
      },
      {
        id: 'file-a',
        url: 'https://example.test/a.png',
        storage_type: 'local',
        category: 'image',
      },
    ])
    editorStore.extensionToAdd = {
      extension: '',
      extension_type: ExtensionType.WEBSITE,
    }
    editorStore.websiteToAdd = { title: 'Example', site: 'https://example.com' }

    await editorStore.handleAddOrUpdateEcho(false)

    expect(fetchAddEchoMock).toHaveBeenCalledWith({
      content: 'hello',
      private: false,
      layout: ImageLayout.WATERFALL,
      extension: {
        type: ExtensionType.WEBSITE,
        payload: { title: 'Example', site: 'https://example.com' },
      },
      tags: [{ name: 'one' }, { name: 'two' }],
      echo_files: [
        { file_id: 'file-b', sort_order: 0 },
        { file_id: 'file-a', sort_order: 1 },
      ],
    })
    expect(editorStore.echoToAdd.echo_files).toBeUndefined()
    expect(editorStore.echoToAdd.extension).toBeUndefined()
  })

  it('keeps the Live Photo image and motion ids in the derived payload', async () => {
    const editorStore = useEditorStore()
    editorStore.setFilesToAdd([
      {
        id: 'live-image',
        url: '/images/live.jpg',
        storage_type: 'local',
        category: 'image',
        is_live_photo: true,
        live_video_id: 'live-motion',
        live_video_url: '/images/live.mov',
      },
    ])
    await editorStore.handleAddOrUpdateEcho(false)
    expect(fetchAddEchoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        echo_files: [
          { file_id: 'live-image', sort_order: 0 },
          { file_id: 'live-motion', sort_order: 1 },
        ],
      }),
    )
  })

  it('refuses to submit an incomplete extension', async () => {
    const editorStore = useEditorStore()

    editorStore.echoToAdd.content = 'hello'
    editorStore.extensionToAdd = {
      extension: '',
      extension_type: ExtensionType.WEBSITE,
    }
    editorStore.websiteToAdd = { title: 'Example', site: '' }

    await editorStore.handleAddOrUpdateEcho(false)

    expect(fetchAddEchoMock).not.toHaveBeenCalled()
  })
  it.each(['image-first', 'motion-first'])(
    'pairs a retried Live Photo across separate batches: %s',
    async (order) => {
      const store = useEditorStore()
      const image = {
        id: 'still',
        url: '/images/IMG_1.jpg',
        key: 'IMG_1.jpg',
        name: 'IMG_1.HEIC',
        category: 'image',
        storage_type: 'local',
        live_pair_id: 'pair-1',
      } as App.Api.Ech0.FileToAdd
      const motion = {
        id: 'motion',
        url: '/images/IMG_1.mov',
        key: 'IMG_1.mov',
        name: 'IMG_1.MOV',
        category: 'video',
        storage_type: 'local',
        live_pair_id: 'pair-1',
      } as App.Api.Ech0.FileToAdd
      const [first, second] = order === 'image-first' ? [image, motion] : [motion, image]
      await store.handleUppyUploaded([first!])
      await store.handleUppyUploaded([second!])
      await store.handleUppyUploaded([image, motion])
      expect(store.filesToAdd).toHaveLength(1)
      expect(store.filesToAdd[0]).toMatchObject({
        id: 'still',
        is_live_photo: true,
        live_video_id: 'motion',
        live_video_url: motion.url,
      })
      await store.handleAddOrUpdateEcho(false)
      expect(fetchAddEchoMock).toHaveBeenCalledWith(
        expect.objectContaining({
          echo_files: [
            { file_id: 'still', sort_order: 0 },
            { file_id: 'motion', sort_order: 1 },
          ],
        }),
      )
    },
  )

  it('does not replace a completed pair when later uploads have the same basename', async () => {
    const store = useEditorStore()
    store.setFilesToAdd([
      {
        id: 'old-still',
        url: '/images/IMG_1.jpg',
        name: 'IMG_1.jpg',
        category: 'image',
        storage_type: 'local',
        live_video_id: 'old-motion',
        live_video_url: '/images/old.mov',
        is_live_photo: true,
      },
    ])
    await store.handleUppyUploaded([
      {
        id: 'new-still',
        url: '/images/new.jpg',
        name: 'IMG_1.jpg',
        category: 'image',
        storage_type: 'local',
        live_pair_id: 'new-pair',
      },
      {
        id: 'new-motion',
        url: '/images/new.mov',
        name: 'IMG_1.mov',
        category: 'video',
        storage_type: 'local',
        live_pair_id: 'new-pair',
      },
    ])
    expect(store.filesToAdd.map((file) => [file.id, file.live_video_id])).toEqual([
      ['old-still', 'old-motion'],
      ['new-still', 'new-motion'],
    ])
  })
  it('serializes overlapping completion callbacks while still image sizing is pending', async () => {
    const store = useEditorStore()
    let sized!: (size: { width: number; height: number }) => void
    vi.mocked(getImageSize).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          sized = resolve
        }),
    )
    const first = store.handleUppyUploaded([
      {
        id: 'concurrent-still',
        url: '/images/IMG_2.jpg',
        category: 'image',
        storage_type: 'local',
        live_pair_id: 'p2',
      },
    ])
    await Promise.resolve()
    const retry = store.handleUppyUploaded([
      {
        id: 'concurrent-motion',
        url: '/images/IMG_2.mov',
        category: 'video',
        storage_type: 'local',
        live_pair_id: 'p2',
      },
    ])
    sized({ width: 10, height: 20 })
    await Promise.all([first, retry])
    expect(store.filesToAdd).toHaveLength(1)
    expect(store.filesToAdd[0]).toMatchObject({
      id: 'concurrent-still',
      live_video_id: 'concurrent-motion',
      category: 'image',
    })
  })
})
