// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TheUploader from '@/components/advanced/TheUploader.vue'
import { deleteFileById } from '@/lib/file'
import { httpUpload } from '@/lib/file/upload'
import { FILE_STORAGE_TYPE } from '@/constants/file'

type FileToAdd = App.Api.Ech0.FileToAdd

type EditorState = {
  filesToAdd: FileToAdd[]
  fileUploading: boolean
  isUpdateMode: boolean
  handleAddOrUpdateEcho: () => void
  handleUppyUploaded: (files: FileToAdd[]) => Promise<void>
  removeFileAt: () => void
  reorderFilesByIds: () => void
}

const shared = vi.hoisted(() => ({
  editorState: null as unknown as EditorState,
}))

vi.mock('@/stores', async () => {
  // vi.mock factories are hoisted above static imports, so Vue must be loaded
  // inside the factory; a static import would be uninitialized here.
  const { reactive } = await import('vue')
  const editorState = reactive({
    filesToAdd: [] as FileToAdd[],
    fileUploading: false,
    isUpdateMode: false,
    handleAddOrUpdateEcho: vi.fn(),
    handleUppyUploaded: async (uploadedFiles: FileToAdd[]) => {
      for (const file of uploadedFiles) {
        // Mirrors the real handler: each attachment is added asynchronously
        // (image dimension lookup), so the store grows one entry per tick.
        await Promise.resolve()
        editorState.filesToAdd.push(file)
      }
    },
    removeFileAt: vi.fn((index: number) => {
      editorState.filesToAdd.splice(index, 1)
    }),
    reorderFilesByIds: vi.fn(),
  })
  shared.editorState = editorState as unknown as EditorState
  return { useEditorStore: () => editorState }
})

vi.mock('@/composables/useBaseDialog', () => ({
  useBaseDialog: () => ({ openConfirm: ({ onConfirm }: { onConfirm: () => void }) => onConfirm() }),
}))

vi.mock('@/lib/file', () => ({
  deleteFileById: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ authHeader: '' }),
}))

vi.mock('@/stores/user', () => ({
  useUserStore: () => ({ isLogin: true }),
}))

vi.mock('@/lib/file/upload', () => ({
  UPLOAD_KIND: { LOCAL: 'local', S3: 's3' },
  httpUpload: vi.fn(async (file: File) => ({
    responseBody: {
      data: {
        id: `file-${file.name}`,
        url: `https://example.test/${file.name}`,
        key: `key-${file.name}`,
        content_type: file.type,
        size: file.size,
      },
    },
  })),
}))

vi.mock('@/lib/file/compress', () => ({
  compressImage: async (file: File) => file,
  inferFileExtFromType: () => '.png',
}))

vi.mock('@/lib/file/api/adapter', () => ({
  getPresign: vi.fn(),
  updateFileMeta: vi.fn(),
}))

vi.mock('@/utils/image', () => ({
  getImageSize: async () => ({ width: 1, height: 1 }),
}))

vi.mock('@/utils/toast', () => ({
  theToast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const wrappers: VueWrapper[] = []

const flushTicks = async (count = 12) => {
  for (let i = 0; i < count; i += 1) await Promise.resolve()
}

describe('TheUploader', () => {
  beforeEach(() => {
    shared.editorState.filesToAdd.splice(0)
    shared.editorState.isUpdateMode = false
    vi.mocked(shared.editorState.handleAddOrUpdateEcho).mockClear()
    vi.mocked(shared.editorState.reorderFilesByIds).mockClear()
    vi.mocked(deleteFileById).mockReset()
    vi.mocked(deleteFileById).mockResolvedValue(undefined as never)
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  })

  it('keeps every uploaded item while the store attaches them one by one', async () => {
    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
      new File(['c'], 'c.png', { type: 'image/png' }),
    ]
    const wrapper = mount(TheUploader, {
      props: {
        fileStorageType: FILE_STORAGE_TYPE.LOCAL,
        EnableCompressor: false,
        allowedFileTypes: ['image/*'],
        maxFiles: 9,
      },
    })
    wrappers.push(wrapper)

    const input = wrapper.find('input[type="file"]')
    const fileList = {
      0: files[0],
      1: files[1],
      2: files[2],
      length: files.length,
      item: (index: number) => files[index] ?? null,
      [Symbol.iterator]: () => files[Symbol.iterator](),
    } as unknown as FileList
    Object.defineProperty(input.element, 'files', { value: fileList, configurable: true })
    await input.trigger('change')

    await flushTicks()

    expect(shared.editorState.filesToAdd).toHaveLength(3)
    expect(wrapper.findAll('li')).toHaveLength(3)
  })

  it('lists existing attachments so they can be reordered', async () => {
    shared.editorState.filesToAdd.push({
      id: 'existing-1',
      url: 'https://example.test/a.png',
      key: 'images/a.png',
      storage_type: FILE_STORAGE_TYPE.LOCAL,
      category: 'image',
      content_type: 'image/png',
      size: 123,
    } as FileToAdd)

    const wrapper = mount(TheUploader, {
      props: {
        fileStorageType: FILE_STORAGE_TYPE.LOCAL,
        EnableCompressor: false,
        allowedFileTypes: ['image/*'],
        maxFiles: 9,
      },
    })
    wrappers.push(wrapper)
    await flushTicks()

    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('a.png')
  })

  it('persists the new order when updating an existing echo', async () => {
    shared.editorState.filesToAdd.push(
      {
        id: 'existing-1',
        url: 'https://example.test/a.png',
        key: 'images/a.png',
        storage_type: FILE_STORAGE_TYPE.LOCAL,
        category: 'image',
        content_type: 'image/png',
        size: 123,
      } as FileToAdd,
      {
        id: 'existing-2',
        url: 'https://example.test/b.png',
        key: 'images/b.png',
        storage_type: FILE_STORAGE_TYPE.LOCAL,
        category: 'image',
        content_type: 'image/png',
        size: 456,
      } as FileToAdd,
    )
    shared.editorState.isUpdateMode = true

    const wrapper = mount(TheUploader, {
      props: {
        fileStorageType: FILE_STORAGE_TYPE.LOCAL,
        EnableCompressor: false,
        allowedFileTypes: ['image/*'],
        maxFiles: 9,
      },
    })
    wrappers.push(wrapper)
    await flushTicks()

    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(2)

    await rows[0]!.trigger('dragstart', {
      dataTransfer: { setData: vi.fn(), effectAllowed: '' },
    })
    await rows[1]!.trigger('drop')
    await flushTicks()

    expect(shared.editorState.reorderFilesByIds).toHaveBeenCalled()
    expect(shared.editorState.handleAddOrUpdateEcho).toHaveBeenCalledWith(true)
  })

  it('drops the queue item when its attachment leaves the store', async () => {
    const wrapper = mount(TheUploader, {
      props: {
        fileStorageType: FILE_STORAGE_TYPE.LOCAL,
        EnableCompressor: false,
        allowedFileTypes: ['image/*'],
        maxFiles: 9,
      },
    })
    wrappers.push(wrapper)

    const files = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ]
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: {
        0: files[0],
        1: files[1],
        length: 2,
        item: (index: number) => files[index] ?? null,
      } as unknown as FileList,
      configurable: true,
    })
    await input.trigger('change')
    await flushTicks()

    shared.editorState.filesToAdd.splice(0, 1)
    await flushTicks()

    expect(wrapper.findAll('li')).toHaveLength(1)
  })
  it('keeps the motion queue row attached and removes both ids when either half is removed', async () => {
    shared.editorState.filesToAdd.push(
      {
        id: 'still',
        url: '/images/IMG_1.jpg',
        key: 'IMG_1.jpg',
        category: 'image',
        storage_type: 'local',
        live_pair_id: 'p',
      } as FileToAdd,
      {
        id: 'motion',
        url: '/images/IMG_1.mov',
        key: 'IMG_1.mov',
        category: 'video',
        storage_type: 'local',
        live_pair_id: 'p',
      } as FileToAdd,
    )
    const wrapper = mount(TheUploader, {
      props: { fileStorageType: FILE_STORAGE_TYPE.LOCAL, EnableCompressor: false, maxFiles: 9 },
    })
    wrappers.push(wrapper)
    await flushTicks()
    shared.editorState.filesToAdd[0]!.live_video_id = 'motion'
    shared.editorState.filesToAdd[0]!.live_video_url = '/images/IMG_1.mov'
    shared.editorState.filesToAdd.splice(1, 1)
    await flushTicks()
    expect(wrapper.findAll('li')).toHaveLength(2)
    await wrapper.findAll('li')[1]!.get('button[title="uploader.removeItem"]').trigger('click')
    await flushTicks()
    expect(deleteFileById).toHaveBeenCalledWith('still')
    expect(deleteFileById).toHaveBeenCalledWith('motion')
    expect(shared.editorState.filesToAdd).toHaveLength(0)
    expect(wrapper.findAll('li')).toHaveLength(0)
  })
  it('never deletes an unrelated existing image when removing an upload with no result id', async () => {
    shared.editorState.filesToAdd.push({
      id: 'keep',
      url: '/images/keep.jpg',
      key: 'keep.jpg',
      category: 'image',
      storage_type: 'local',
    } as FileToAdd)
    vi.mocked(httpUpload).mockRejectedValueOnce(new Error('fixture upload failure'))
    const wrapper = mount(TheUploader, {
      props: { fileStorageType: FILE_STORAGE_TYPE.LOCAL, EnableCompressor: false, maxFiles: 9 },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['x'], 'failed.png', { type: 'image/png' })],
      configurable: true,
    })
    await input.trigger('change')
    await flushTicks()
    expect(wrapper.findAll('li')).toHaveLength(2)
    await wrapper.findAll('li')[1]!.get('button[title="uploader.removeItem"]').trigger('click')
    await flushTicks()
    expect(deleteFileById).not.toHaveBeenCalled()
    expect(shared.editorState.filesToAdd.map((file) => file.id)).toEqual(['keep'])
    expect(wrapper.findAll('li')).toHaveLength(1)
  })

  it('cancels a pending pair atomically without starting the waiting motion upload', async () => {
    vi.mocked(httpUpload).mockImplementationOnce(
      (_file, _config, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () =>
            reject(new DOMException('fixture cancellation', 'AbortError')),
          )
        }),
    )
    const wrapper = mount(TheUploader, {
      props: {
        fileStorageType: FILE_STORAGE_TYPE.LOCAL,
        EnableCompressor: false,
        maxFiles: 9,
        allowedFileTypes: ['image/*', 'video/*'],
      },
    })
    wrappers.push(wrapper)
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', {
      value: [
        new File(['x'], 'IMG_2.jpg', { type: 'image/jpeg' }),
        new File(['v'], 'IMG_2.mov', { type: 'video/quicktime' }),
      ],
      configurable: true,
    })
    await input.trigger('change')
    await flushTicks(25)
    expect(wrapper.findAll('li')).toHaveLength(2)
    expect(httpUpload).toHaveBeenCalledTimes(1)
    await wrapper.findAll('li')[0]!.get('button[title="uploader.removeItem"]').trigger('click')
    await flushTicks()
    expect(wrapper.findAll('li')).toHaveLength(0)
    expect(httpUpload).toHaveBeenCalledTimes(1)
    expect(deleteFileById).not.toHaveBeenCalled()
  })
})
