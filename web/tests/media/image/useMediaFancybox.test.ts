// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMediaFancybox, type MediaGalleryItem } from '@/composables/useMediaFancybox'
import type { CarouselSlide, FancyboxOptions } from '@fancyapps/ui'

const mockFancyboxShow = vi.fn()
const mockFancyboxClose = vi.fn()
const mockFancyboxDestroy = vi.fn()

vi.mock('@fancyapps/ui', () => ({
  Fancybox: {
    show: (...args: unknown[]) => mockFancyboxShow(...args),
    close: (...args: unknown[]) => mockFancyboxClose(...args),
    destroy: (...args: unknown[]) => mockFancyboxDestroy(...args),
  },
}))

describe('useMediaFancybox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFancyboxShow.mockReturnValue({ close: mockFancyboxClose })
  })

  it('initializes and opens Fancybox with correct slides and default toolbar options', () => {
    const items = ref<MediaGalleryItem[]>([
      { src: 'https://example.com/1.jpg', thumb: 'https://example.com/1-thumb.jpg', alt: 'Pic 1' },
      { src: 'https://example.com/2.mp4', caption: 'Video 2' },
    ])

    const wrapper = mount(
      defineComponent({
        setup() {
          const { open, close } = useMediaFancybox(items)
          return { open, close }
        },
        template: '<div />',
      }),
    )

    wrapper.vm.open(0)

    expect(mockFancyboxShow).toHaveBeenCalledTimes(1)
    const [slides, options] = mockFancyboxShow.mock.calls[0] as [
      Partial<CarouselSlide>[],
      Partial<FancyboxOptions>,
    ]

    expect(slides).toHaveLength(2)
    expect(slides[0]).toMatchObject({
      src: 'https://example.com/1.jpg',
      thumb: 'https://example.com/1-thumb.jpg',
      thumbSrc: 'https://example.com/1-thumb.jpg',
      alt: 'Pic 1',
      type: 'image',
    })
    expect(slides[1]).toMatchObject({
      src: 'https://example.com/2.mp4',
      caption: 'Video 2',
      type: 'html5video',
      autoplay: true,
      html5videoFormat: 'video/mp4',
    })

    // Carousel toolbar & thumbs
    expect(options.Carousel?.Video).toEqual({ autoplay: true })
    expect(options.Carousel?.Toolbar?.display?.right).toEqual([
      'zoomIn',
      'zoomOut',
      'autoplay',
      'fullscreen',
      'thumbs',
      'close',
    ])
    expect(options.Carousel?.Thumbs?.type).toBe('classic')
    expect(options.Carousel?.Thumbs?.showOnStart).toBe(true)
    expect(options.Carousel?.Thumbs?.minCount).toBe(1)
    expect(options.dragToClose).toBe(true)
    expect(options.hideScrollbar).toBe(false)
  })

  it('attaches triggerEl to the active slide when sourceElement is provided', () => {
    const items = ref<MediaGalleryItem[]>([
      { src: 'https://example.com/1.jpg' },
      { src: 'https://example.com/2.jpg' },
    ])

    const sourceEl = document.createElement('img')

    const wrapper = mount(
      defineComponent({
        setup() {
          const { open } = useMediaFancybox(items)
          return { open }
        },
        template: '<div />',
      }),
    )

    wrapper.vm.open(1, sourceEl)

    const [slides, options] = mockFancyboxShow.mock.calls[0] as [
      Partial<CarouselSlide>[],
      Partial<FancyboxOptions>,
    ]

    expect(options.startIndex).toBe(1)
    expect(slides[0].triggerEl).toBeUndefined()
    expect(slides[1].triggerEl).toBe(sourceEl)
  })

  it('closes Fancybox on unmount', () => {
    const items = ref<MediaGalleryItem[]>([{ src: 'https://example.com/1.jpg' }])

    const wrapper = mount(
      defineComponent({
        setup() {
          const { open, close } = useMediaFancybox(items)
          return { open, close }
        },
        template: '<div />',
      }),
    )

    wrapper.vm.open(0)
    expect(mockFancyboxShow).toHaveBeenCalledTimes(1)

    wrapper.unmount()
    expect(mockFancyboxClose).toHaveBeenCalledTimes(1)
  })

  it('supports overriding items dynamically in open()', () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const { open } = useMediaFancybox()
          return { open }
        },
        template: '<div />',
      }),
    )

    const dynamicItems: MediaGalleryItem[] = [
      { src: 'https://example.com/custom.jpg', caption: 'Custom' },
    ]

    wrapper.vm.open(0, null, dynamicItems)

    expect(mockFancyboxShow).toHaveBeenCalledTimes(1)
    const [slides] = mockFancyboxShow.mock.calls[0] as [Array<Record<string, unknown>>]
    expect(slides[0].src).toBe('https://example.com/custom.jpg')
    expect(slides[0].caption).toBe('Custom')
  })

  it('renders live photo items as unified image slides with has-livephoto class and videoSrc', () => {
    const wrapper = mount(
      defineComponent({
        setup() {
          const { open } = useMediaFancybox()
          return { open }
        },
        template: '<div />',
      }),
    )

    const liveItems: MediaGalleryItem[] = [
      {
        src: 'https://example.com/live.png',
        thumb: 'https://example.com/live-thumb.png',
        videoSrc: 'https://example.com/live.mov',
        isLivePhoto: true,
      },
    ]

    wrapper.vm.open(0, null, liveItems)

    expect(mockFancyboxShow).toHaveBeenCalledTimes(1)
    const [slides] = mockFancyboxShow.mock.calls[0] as [Array<Record<string, unknown>>]
    expect(slides[0].type).toBe('image')
    expect(slides[0].class).toBe('has-livephoto')
    expect(slides[0].isLivePhoto).toBe(true)
    expect(slides[0].videoSrc).toBe('https://example.com/live.mov')
    expect(slides[0].thumbSrc).toBe('https://example.com/live-thumb.png')
    expect(slides[0].src).toBe('https://example.com/live.png')
  })
})

