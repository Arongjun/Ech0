// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { onBeforeUnmount, shallowRef, type Ref } from 'vue'
import PhotoSwipe from 'photoswipe'
import 'photoswipe/style.css'
import '@/styles/photoswipe-livephoto.css'

export type PhotoSwipeItem = {
  src: string
  thumb?: string
  width?: number
  height?: number
  alt?: string
  isLivePhoto?: boolean
  videoSrc?: string
}

type ResolvedDimensions = {
  width?: number
  height?: number
}

const LIVEPHOTO_AUTOPLAY_STORAGE_KEY = 'livePhotoAutoPlay'

export const getLivePhotoAutoPlay = (): boolean => {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(LIVEPHOTO_AUTOPLAY_STORAGE_KEY) !== 'false'
}

export const setLivePhotoAutoPlay = (enabled: boolean): void => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LIVEPHOTO_AUTOPLAY_STORAGE_KEY, String(enabled))
}

export const toggleLivePhotoAutoPlay = (): boolean => {
  const next = !getLivePhotoAutoPlay()
  setLivePhotoAutoPlay(next)
  return next
}

const resolveThumbImageSrc = (sourceElement?: HTMLElement | null) => {
  if (!sourceElement) return undefined

  const thumbnail =
    sourceElement instanceof HTMLImageElement
      ? sourceElement
      : (sourceElement.querySelector('img') as HTMLImageElement | null)

  if (!thumbnail) return undefined

  return thumbnail.currentSrc || thumbnail.src || undefined
}

const resolveThumbNaturalSize = (sourceElement?: HTMLElement | null): ResolvedDimensions => {
  if (!sourceElement) return {}

  const thumbnail =
    sourceElement instanceof HTMLImageElement
      ? sourceElement
      : (sourceElement.querySelector('img') as HTMLImageElement | null)

  if (!thumbnail) return {}

  const width = thumbnail.naturalWidth
  const height = thumbnail.naturalHeight
  if (width > 0 && height > 0) {
    return { width, height }
  }

  return {}
}

const isValidDimension = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const hasValidDimensions = (item: PhotoSwipeItem) =>
  isValidDimension(item.width) && isValidDimension(item.height)

const loadImageNaturalSize = (src: string) =>
  new Promise<ResolvedDimensions>((resolve) => {
    const image = new Image()
    image.onload = () => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      if (width > 0 && height > 0) {
        resolve({ width, height })
        return
      }
      resolve({})
    }
    image.onerror = () => resolve({})
    image.src = src
  })

function setupPhotoSwipeLivePhoto(pswp: PhotoSwipe) {
  interface LiveRecord {
    video: HTMLVideoElement
    badgeWrapper: HTMLElement
    cleanup: () => void
  }
  const liveMap = new WeakMap<object, LiveRecord>()

  const playLiveVideo = async (video: HTMLVideoElement) => {
    try {
      video.currentTime = 0
      await video.play()
      video.classList.add('is-active')
    } catch {
      video.muted = true
      try {
        await video.play()
        video.classList.add('is-active')
      } catch {
        // Playback could not be started
      }
    }
  }

  const stopLiveVideo = (video: HTMLVideoElement) => {
    video.classList.remove('is-active')
    video.pause()
    video.currentTime = 0
  }

  const initSlide = (slide: {
    container?: HTMLElement | null
    content?: {
      data?: Record<string, unknown>
      displayedImageWidth?: number
      displayedImageHeight?: number
    }
    width?: number
    height?: number
  }) => {
    if (!slide || !slide.content) return
    const content = slide.content
    const data = content.data as Record<string, unknown> | undefined
    if (!data?.isLivePhoto || !data?.videoSrc) return
    if (liveMap.has(content as object)) return

    const container = slide.container
    if (!container) return

    const video = document.createElement('video')
    video.className = 'pswp-livephoto-video'
    video.src = String(data.videoSrc)
    video.preload = 'metadata'
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('disablepictureinpicture', '')

    const syncSize = (w?: number, h?: number) => {
      const width = w || content.displayedImageWidth || slide.width
      const height = h || content.displayedImageHeight || slide.height
      if (width && height) {
        video.style.width = `${width}px`
        video.style.height = `${height}px`
      }
    }
    syncSize()

    const badgeWrapper = document.createElement('div')
    badgeWrapper.className = 'pswp-livephoto-badge-wrapper'

    const renderBadge = () => {
      const autoPlay = getLivePhotoAutoPlay()
      badgeWrapper.innerHTML = `
        <div class="pswp-livephoto-badge">
          <svg class="pswp-livephoto-icon ${autoPlay ? '' : 'is-disabled'}" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
            ${autoPlay ? '' : '<line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/>'}
          </svg>
          <span class="pswp-livephoto-label">LIVE</span>
          <svg class="pswp-livephoto-chevron" viewBox="0 0 12 12" fill="none">
            <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="pswp-livephoto-dropdown">
          <div class="pswp-livephoto-dropdown-item" data-action="toggle-autoplay">
            <span class="pswp-livephoto-dropdown-text">${autoPlay ? '关闭自动播放' : '开启自动播放'}</span>
            <svg class="pswp-livephoto-dropdown-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
              ${autoPlay ? '' : '<line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/>'}
            </svg>
          </div>
        </div>
      `
    }
    renderBadge()

    container.appendChild(video)
    container.appendChild(badgeWrapper)

    const onEnded = () => {
      video.classList.remove('is-active')
      video.pause()
      video.currentTime = 0
    }
    video.addEventListener('ended', onEnded)

    const onBadgeClick = (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      const target = e.target as HTMLElement
      if (target.closest('[data-action="toggle-autoplay"]')) {
        toggleLivePhotoAutoPlay()
        renderBadge()
        badgeWrapper.classList.remove('is-open')
        return
      }
      if (target.closest('.pswp-livephoto-chevron')) {
        badgeWrapper.classList.toggle('is-open')
        return
      }
      badgeWrapper.classList.remove('is-open')
      void playLiveVideo(video)
    }
    badgeWrapper.addEventListener('click', onBadgeClick)

    const onDocClick = (e: MouseEvent) => {
      if (!badgeWrapper.contains(e.target as Node)) {
        badgeWrapper.classList.remove('is-open')
      }
    }
    document.addEventListener('click', onDocClick)

    let longPressTimer: ReturnType<typeof setTimeout> | null = null
    const onPointerDown = (e: PointerEvent) => {
      if (badgeWrapper.contains(e.target as Node)) return
      longPressTimer = setTimeout(() => {
        void playLiveVideo(video)
      }, 280)
    }
    const onPointerUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
    }
    container.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)

    const cleanup = () => {
      video.removeEventListener('ended', onEnded)
      badgeWrapper.removeEventListener('click', onBadgeClick)
      document.removeEventListener('click', onDocClick)
      container.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      if (longPressTimer) clearTimeout(longPressTimer)
      video.pause()
      video.src = ''
      video.remove()
      badgeWrapper.remove()
    }

    liveMap.set(content as object, { video, badgeWrapper, cleanup })
  }

  const autoPlayCurrentSlide = () => {
    const slide = pswp.currSlide as
      | {
          content?: {
            data?: Record<string, unknown>
          }
        }
      | undefined
    if (!slide || !slide.content) return
    initSlide(slide)
    const record = liveMap.get(slide.content as object)
    if (record && getLivePhotoAutoPlay()) {
      void playLiveVideo(record.video)
    }
  }

  pswp.on('afterSetContent', ({ slide }: { slide: unknown }) => {
    initSlide(
      slide as {
        container?: HTMLElement | null
        content?: {
          data?: Record<string, unknown>
          displayedImageWidth?: number
          displayedImageHeight?: number
        }
        width?: number
        height?: number
      },
    )
  })

  pswp.on(
    'imageSizeChange',
    ({ content, width, height }: { content: object; width: number; height: number }) => {
      const record = liveMap.get(content)
      if (record) {
        record.video.style.width = `${width}px`
        record.video.style.height = `${height}px`
      }
    },
  )

  pswp.on(
    'zoomPanUpdate',
    ({
      slide,
    }: {
      slide: {
        content: object
        currZoomLevel: number
        zoomLevels?: { initial?: number }
      }
    }) => {
      const record = liveMap.get(slide.content)
      if (record) {
        const isZoomed = slide.currZoomLevel > (slide.zoomLevels?.initial || 1) * 1.05
        record.badgeWrapper.classList.toggle('is-zoomed', isZoomed)
      }
    },
  )

  pswp.on('openingAnimationEnd', () => {
    autoPlayCurrentSlide()
  })

  pswp.on('firstZoomPan', () => {
    setTimeout(autoPlayCurrentSlide, 350)
  })

  pswp.on('change', () => {
    const holders = (pswp.mainScroll?.itemHolders || []) as Array<{
      slide?: { content?: object }
    }>
    holders.forEach((holder) => {
      if (holder.slide && holder.slide !== pswp.currSlide) {
        const r = holder.slide.content ? liveMap.get(holder.slide.content) : undefined
        if (r) stopLiveVideo(r.video)
      }
    })
    setTimeout(autoPlayCurrentSlide, 60)
  })

  pswp.on('close', () => {
    const holders = (pswp.mainScroll?.itemHolders || []) as Array<{
      slide?: { content?: object }
    }>
    holders.forEach((holder) => {
      if (holder.slide && holder.slide.content) {
        const r = liveMap.get(holder.slide.content)
        if (r) stopLiveVideo(r.video)
      }
    })
  })

  pswp.on('destroy', () => {
    const holders = (pswp.mainScroll?.itemHolders || []) as Array<{
      slide?: { content?: object }
    }>
    holders.forEach((holder) => {
      if (holder.slide && holder.slide.content) {
        const r = liveMap.get(holder.slide.content)
        if (r) {
          r.cleanup()
        }
      }
    })
  })
}

export const usePhotoSwipeGallery = (items: Ref<PhotoSwipeItem[]>) => {
  const instance = shallowRef<PhotoSwipe | null>(null)
  const dimensionCache = new Map<string, Promise<ResolvedDimensions>>()
  let latestOpenToken = 0

  const destroy = () => {
    instance.value?.destroy()
    instance.value = null
  }

  const resolveItemDimensions = (
    item: PhotoSwipeItem,
    override?: ResolvedDimensions,
  ): Promise<ResolvedDimensions> => {
    if (override?.width && override?.height) {
      return Promise.resolve(override)
    }

    if (hasValidDimensions(item)) {
      return Promise.resolve({
        width: item.width,
        height: item.height,
      })
    }

    if (!item.src) return Promise.resolve({})

    const cached = dimensionCache.get(item.src)
    if (cached) return cached

    const request = loadImageNaturalSize(item.src)
    dimensionCache.set(item.src, request)
    return request
  }

  const resolveAllImageDimensions = async (
    currentIndex: number,
    sourceElement?: HTMLElement | null,
  ) => {
    const currentSlideNaturalSize = resolveThumbNaturalSize(sourceElement)

    return Promise.all(
      items.value.map((item, index) => {
        const override = index === currentIndex ? currentSlideNaturalSize : undefined
        return resolveItemDimensions(item, override)
      }),
    )
  }

  const open = (startIndex: number, sourceElement?: HTMLElement | null) => {
    const openToken = ++latestOpenToken
    void (async () => {
      if (!items.value.length) return

      destroy()

      const normalizedIndex = Math.min(Math.max(startIndex, 0), items.value.length - 1)
      const thumbImageSrc = resolveThumbImageSrc(sourceElement)
      const resolvedDimensions = await resolveAllImageDimensions(normalizedIndex, sourceElement)

      if (openToken !== latestOpenToken || !items.value.length) return

      const dataSource = items.value.map((item, index) => {
        const resolved = resolvedDimensions[index] || {}
        const baseItem = {
          src: item.src,
          width: resolved.width || item.width,
          height: resolved.height || item.height,
          alt: item.alt,
          isLivePhoto: item.isLivePhoto,
          videoSrc: item.videoSrc,
        }

        if (index === normalizedIndex && sourceElement) {
          return {
            ...baseItem,
            element: sourceElement,
            msrc: thumbImageSrc || item.src,
          }
        }

        if (index === normalizedIndex && thumbImageSrc) {
          return {
            ...baseItem,
            msrc: thumbImageSrc,
          }
        }

        return baseItem
      })

      const pswp = new PhotoSwipe({
        dataSource,
        index: normalizedIndex,
        bgOpacity: 0.85,
        showHideAnimationType: 'zoom',
        preloadFirstSlide: true,
        escKey: true,
        arrowKeys: true,
        bgClickAction: 'close',
        closeOnVerticalDrag: true,
        clickToCloseNonZoomable: true,
      })

      pswp.on('destroy', () => {
        if (instance.value === pswp) {
          instance.value = null
        }
      })

      if (thumbImageSrc) {
        pswp.addFilter('placeholderSrc', (placeholderSrc, content) => {
          if (content.slide?.index === normalizedIndex) {
            return thumbImageSrc
          }
          return placeholderSrc
        })
      }

      setupPhotoSwipeLivePhoto(pswp)

      instance.value = pswp
      pswp.init()
    })()
  }

  onBeforeUnmount(() => {
    destroy()
  })

  return {
    open,
    destroy,
  }
}
