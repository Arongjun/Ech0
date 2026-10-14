// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TheVideoPlayer from '@/components/advanced/media/video/TheVideoPlayer.vue'

const mockOpen = vi.fn()
const mockClose = vi.fn()

vi.mock('@/composables/useMediaFancybox', () => ({
  useMediaFancybox: () => ({
    open: mockOpen,
    close: mockClose,
  }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('TheVideoPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.HTMLMediaElement.prototype.pause = vi.fn()
  })

  it('renders video player elements and opens Fancybox on fullscreen click', async () => {
    const files: App.Api.Ech0.FileObject[] = [
      {
        id: 'vid-1',
        name: 'sample.mp4',
        url: 'https://example.com/sample.mp4',
        category: 'video',
        size: 1024,
        created_at: 0,
        updated_at: 0,
        deleted_at: 0,
        width: 1920,
        height: 1080,
      },
    ]

    const wrapper = mount(TheVideoPlayer, {
      props: {
        files,
      },
    })

    const poster = wrapper.find('.video-media__poster')
    expect(poster.exists()).toBe(true)

    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toContain('sample.mp4')

    const fullscreenBtn = wrapper.find('.video-media__fullscreen')
    expect(fullscreenBtn.exists()).toBe(true)

    await fullscreenBtn.trigger('click')

    expect(mockOpen).toHaveBeenCalledTimes(1)
    expect(mockOpen).toHaveBeenCalledWith(0, expect.anything())
  })
})
