// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { onBeforeUnmount, shallowRef, unref, type MaybeRef } from 'vue'
import { Fancybox, type CarouselSlide, type FancyboxOptions } from '@fancyapps/ui'
import '@fancyapps/ui/dist/fancybox/fancybox.css'

export interface MediaGalleryItem {
  src: string
  thumb?: string
  alt?: string
  caption?: string
  width?: number
  height?: number
  type?: 'image' | 'video' | 'html'
  videoSrc?: string
  isLivePhoto?: boolean
  [key: string]: unknown
}

export interface UseMediaFancyboxOptions {
  theme?: 'auto' | 'dark' | 'light'
  loop?: boolean
  showThumbsOnStart?: boolean
  thumbsType?: 'classic' | 'modern' | 'scrollable'
  dragToClose?: boolean
  minThumbsCount?: number
}

const isVideoUrl = (url: string) => {
  const clean = url.split('?')[0].split('#')[0].toLowerCase()
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.ogg') ||
    clean.endsWith('.mov')
  )
}

export function useMediaFancybox(
  defaultItems?: MaybeRef<MediaGalleryItem[]>,
  options?: UseMediaFancyboxOptions,
) {
  const activeInstance = shallowRef<ReturnType<typeof Fancybox.show> | null>(null)

  const close = () => {
    try {
      Fancybox.close()
    } catch {
      // ignore
    }
    activeInstance.value = null
  }

  const destroy = () => {
    try {
      Fancybox.destroy()
    } catch {
      // ignore
    }
    activeInstance.value = null
  }

  const open = (
    startIndex = 0,
    sourceElement?: HTMLElement | null,
    overrideItems?: MediaGalleryItem[],
  ) => {
    const rawItems: MediaGalleryItem[] = overrideItems || (defaultItems ? unref(defaultItems) : [])
    if (!rawItems || rawItems.length === 0) return

    const slides: Partial<CarouselSlide>[] = rawItems.map((item, idx) => {
      const src = item.src || ''
      const thumb = item.thumb || src
      const alt = item.alt || ''
      const caption = item.caption

      const isVideo = item.type === 'video' || isVideoUrl(src)

      const slide: Partial<CarouselSlide> = {
        src,
        thumb,
        caption,
        alt,
        width: item.width,
        height: item.height,
        type: isVideo ? 'video' : 'image',
      }

      if (idx === startIndex && sourceElement) {
        slide.triggerEl = sourceElement
      }

      return slide
    })

    const thumbsType = options?.thumbsType || 'classic'
    const showThumbs = options?.showThumbsOnStart ?? true
    const minThumbsCount = options?.minThumbsCount ?? (slides.length > 1 ? 1 : 2)

    try {
      const fancyboxOptions: Partial<FancyboxOptions> = {
        theme: options?.theme || 'auto',
        zoomEffect: true,
        fadeEffect: true,
        startIndex: Math.max(0, Math.min(startIndex, slides.length - 1)),
        backdropClick: 'close',
        dragToClose: options?.dragToClose ?? true,
        closeButton: 'auto',
        keyboard: {
          Escape: 'close',
          Delete: 'close',
          Backspace: 'close',
          PageUp: 'prev',
          PageDown: 'next',
          ArrowUp: 'prev',
          ArrowDown: 'next',
          ArrowRight: 'next',
          ArrowLeft: 'prev',
        },
        Carousel: {
          Toolbar: {
            display: {
              left: ['counter'],
              middle: [],
              right: ['zoomIn', 'zoomOut', 'autoplay', 'fullscreen', 'thumbs', 'close'],
            },
          },
          Thumbs: {
            type: thumbsType,
            showOnStart: showThumbs,
            minCount: minThumbsCount,
          },
        },
        on: {
          destroy: () => {
            activeInstance.value = null
          },
        },
      }

      const instance = Fancybox.show(slides, fancyboxOptions)

      activeInstance.value = instance
    } catch (e) {
      console.error('Failed to open Fancybox gallery:', e)
    }
  }

  onBeforeUnmount(() => {
    close()
  })

  return {
    open,
    close,
    destroy,
    activeInstance,
  }
}
