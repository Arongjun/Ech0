// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { onBeforeUnmount, ref, shallowRef, unref, type MaybeRef } from 'vue'
import {
  Fancybox,
  type CarouselSlide,
  type FancyboxOptions,
  type FancyboxInstance,
  type CarouselInstance,
} from '@fancyapps/ui'
import { i18n } from '@/locales'
import '@fancyapps/ui/dist/fancybox/fancybox.css'
import '@/styles/fancybox-livephoto.css'

export interface MediaGalleryItem {
  src: string
  thumb?: string
  alt?: string
  caption?: string
  width?: number
  height?: number
  type?: 'image' | 'video' | 'html' | 'html5video'
  videoSrc?: string
  poster?: string
  mimeType?: string
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
  zoomEffect?: boolean
  hideScrollbar?: boolean
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

const livePhotoAutoPlay = ref<boolean>(
  typeof localStorage !== 'undefined'
    ? localStorage.getItem('livePhotoAutoPlay') !== 'false'
    : true,
)

export const toggleLivePhotoAutoPlay = () => {
  livePhotoAutoPlay.value = !livePhotoAutoPlay.value
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('livePhotoAutoPlay', String(livePhotoAutoPlay.value))
  }
}

export const getLivePhotoAutoPlay = () => livePhotoAutoPlay.value

function t(key: string, fallback: string): string {
  try {
    if (typeof i18n?.global?.te === 'function' && i18n.global.te(key)) {
      return String(i18n.global.t(key))
    }
  } catch {
    // ignore
  }
  return fallback
}

function createLivePhotoHTML(imageUrl: string, videoUrl: string, altText?: string): string {
  const autoPlayEnabled = livePhotoAutoPlay.value
  const alt = altText || t('imageGallery.livePhoto', '实况照片')
  const autoPlayText = autoPlayEnabled
    ? t('imageGallery.turnOffAutoPlay', '关闭自动播放')
    : t('imageGallery.turnOnAutoPlay', '开启自动播放')

  return `<div class="fancybox-livephoto-container"><div class="livephoto-content"><video class="livephoto-video" src="${videoUrl}" preload="metadata" playsinline disablepictureinpicture></video><img class="livephoto-image" src="${imageUrl}" alt="${alt}" /><div class="livephoto-control-wrapper"><div class="livephoto-icon"><svg class="livephoto-icon-svg ${autoPlayEnabled ? '' : 'disabled'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/>${autoPlayEnabled ? '' : '<line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/>'}</svg><span class="livephoto-label">LIVE</span><svg class="livephoto-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div><div class="livephoto-dropdown"><div class="livephoto-dropdown-item" data-action="toggle-autoplay"><span class="dropdown-text">${autoPlayText}</span><svg class="dropdown-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3" fill="currentColor"/>${autoPlayEnabled ? '' : '<line x1="4" y1="4" x2="20" y2="20"/>'}</svg></div></div></div></div></div>`
}

interface LivePhotoSlideData {
  htmlEl?: HTMLElement | null
  livePhotoCleanup?: (() => void) | null
  livePhotoPause?: (() => void) | null
}

type FancyboxSlideElement = CarouselSlide & LivePhotoSlideData

function initLivePhotoInteraction(slide: FancyboxSlideElement): void {
  try {
    let container: HTMLElement | null = null
    if (slide.htmlEl) {
      container = slide.htmlEl.classList?.contains('fancybox-livephoto-container')
        ? slide.htmlEl
        : slide.htmlEl.querySelector('.fancybox-livephoto-container')
    }
    if (!container && slide.el) {
      container = slide.el.querySelector('.fancybox-livephoto-container')
    }
    if (!container) return

    const video = container.querySelector('.livephoto-video') as HTMLVideoElement | null
    const icon = container.querySelector('.livephoto-icon') as HTMLElement | null
    const controlWrapper = container.querySelector(
      '.livephoto-control-wrapper',
    ) as HTMLElement | null
    const dropdown = container.querySelector('.livephoto-dropdown') as HTMLElement | null
    const livephotoContent = container.querySelector('.livephoto-content') as HTMLElement | null

    if (!video || !icon) return

    const start = (e?: Event) => {
      if (e) {
        e.stopPropagation()
      }
      container?.classList.add('zoom')
      video.currentTime = 0
      video.play().catch(() => {})
    }

    const leave = (e?: Event) => {
      if (e) {
        e.preventDefault()
      }
      container?.classList.remove('zoom')
      video.pause()
    }

    const handleVideoEnded = () => {
      container?.classList.remove('zoom')
    }

    const preventContextMenu = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      return false
    }

    const isMobile = () => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false)

    const showChevron = () => controlWrapper?.classList.add('show-chevron')
    const hideChevron = () => {
      if (!controlWrapper?.classList.contains('show-dropdown')) {
        controlWrapper?.classList.remove('show-chevron')
      }
    }
    const toggleDropdown = (e: Event) => {
      e.stopPropagation()
      e.preventDefault()
      controlWrapper?.classList.toggle('show-dropdown')
    }
    const hideDropdown = () => controlWrapper?.classList.remove('show-dropdown')

    const toggleAutoPlayButton = container.querySelector('[data-action="toggle-autoplay"]')
    if (toggleAutoPlayButton) {
      toggleAutoPlayButton.addEventListener('click', (e) => {
        e.stopPropagation()
        toggleLivePhotoAutoPlay()
        const text = toggleAutoPlayButton.querySelector('.dropdown-text')
        const iconSvg = toggleAutoPlayButton.querySelector('.dropdown-icon')
        const mainIconSvg = icon.querySelector('.livephoto-icon-svg')
        if (text) {
          text.textContent = livePhotoAutoPlay.value
            ? t('imageGallery.turnOffAutoPlay', '关闭自动播放')
            : t('imageGallery.turnOnAutoPlay', '开启自动播放')
        }
        if (iconSvg) {
          iconSvg.innerHTML = `<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3" fill="currentColor"/>${livePhotoAutoPlay.value ? '' : '<line x1="4" y1="4" x2="20" y2="20"/>'}`
        }
        if (mainIconSvg) {
          mainIconSvg.innerHTML = `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="3" fill="currentColor"/>${livePhotoAutoPlay.value ? '' : '<line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/>'}`
        }
        if (isMobile()) {
          hideDropdown()
        }
      })
    }

    let hasHoveredDropdown = false
    if (controlWrapper) {
      controlWrapper.addEventListener('mouseenter', () => {
        if (!isMobile()) showChevron()
      })
      controlWrapper.addEventListener('mouseleave', () => {
        if (!isMobile()) {
          hideChevron()
          if (hasHoveredDropdown) {
            hideDropdown()
            hasHoveredDropdown = false
          }
        }
      })
    }

    if (dropdown) {
      dropdown.addEventListener('mouseenter', () => {
        if (!isMobile()) hasHoveredDropdown = true
      })
    }

    const chevron = icon.querySelector('.livephoto-chevron')
    if (chevron) {
      chevron.addEventListener('click', (e) => {
        if (!isMobile()) {
          toggleDropdown(e)
          hasHoveredDropdown = false
        }
      })
    }

    icon.addEventListener('click', (e) => {
      if (isMobile()) {
        e.stopPropagation()
        toggleDropdown(e)
      }
    })

    const closeOnClickOutside = (e: MouseEvent) => {
      if (!controlWrapper?.contains(e.target as Node)) {
        hideDropdown()
        hasHoveredDropdown = false
        if (!isMobile()) hideChevron()
      }
    }
    document.addEventListener('click', closeOnClickOutside)

    icon.addEventListener('mouseenter', start)
    icon.addEventListener('mouseleave', leave)

    if (livephotoContent) {
      livephotoContent.addEventListener(
        'touchstart',
        (e: TouchEvent) => {
          if (controlWrapper?.contains(e.target as Node)) return
          start(e)
        },
        { passive: false },
      )
      livephotoContent.addEventListener(
        'touchend',
        (e: TouchEvent) => {
          if (controlWrapper?.contains(e.target as Node)) return
          leave(e)
        },
        { passive: false },
      )
      livephotoContent.addEventListener(
        'touchcancel',
        (e: TouchEvent) => {
          if (controlWrapper?.contains(e.target as Node)) return
          leave(e)
        },
        { passive: false },
      )
    }

    container.addEventListener('contextmenu', preventContextMenu, { passive: false })
    icon.addEventListener('contextmenu', preventContextMenu, { passive: false })
    video.addEventListener('ended', handleVideoEnded)

    if (livePhotoAutoPlay.value) {
      setTimeout(() => {
        container?.classList.add('zoom')
        video.currentTime = 0
        video.play().catch(() => {})
      }, 300)
    }

    slide.livePhotoPause = () => {
      video.pause()
      video.currentTime = 0
      container?.classList.remove('zoom')
    }

    slide.livePhotoCleanup = () => {
      document.removeEventListener('click', closeOnClickOutside)
      icon.removeEventListener('mouseenter', start)
      icon.removeEventListener('mouseleave', leave)
      container?.removeEventListener('contextmenu', preventContextMenu)
      icon.removeEventListener('contextmenu', preventContextMenu)
      video.removeEventListener('ended', handleVideoEnded)
      video.pause()
      video.src = ''
    }
  } catch (error) {
    console.error('Live photo init error:', error)
  }
}

function cleanupLivePhoto(slide: FancyboxSlideElement): void {
  if (slide?.livePhotoCleanup) {
    try {
      slide.livePhotoCleanup()
      slide.livePhotoCleanup = null
    } catch {
      // ignore
    }
  }
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

      const isLive = Boolean(item.isLivePhoto && item.videoSrc)
      const isVideo =
        !isLive && (item.type === 'video' || item.type === 'html5video' || isVideoUrl(src))

      if (isLive) {
        const slide: Partial<CarouselSlide> = {
          src,
          thumb,
          caption,
          alt,
          width: item.width,
          height: item.height,
          type: 'html',
          html: createLivePhotoHTML(src, String(item.videoSrc), alt),
          class: 'has-livephoto',
        }
        if (idx === startIndex && sourceElement) {
          slide.triggerEl = sourceElement
        }
        return slide
      }

      const slide: Partial<CarouselSlide> = {
        src,
        thumb,
        caption,
        alt,
        width: item.width,
        height: item.height,
        type: isVideo ? 'html5video' : 'image',
      }

      if (isVideo) {
        slide.poster = (item.poster as string) || (item.thumb as string) || ''
        slide.html5videoFormat = (item.mimeType as string) || 'video/mp4'
        slide.autoplay = true
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
        zoomEffect: options?.zoomEffect ?? false,
        fadeEffect: true,
        hideScrollbar: options?.hideScrollbar ?? false,
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
          Video: {
            autoplay: true,
          },
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
          ready: (fancybox: FancyboxInstance) => {
            const carousel = fancybox.getCarousel()
            if (!carousel) return
            const curIndex =
              typeof fancybox.getSlide === 'function'
                ? (fancybox.getSlide()?.index ?? startIndex)
                : startIndex
            carousel.getSlides().forEach((slide: CarouselSlide, index: number) => {
              const liveSlide = slide as FancyboxSlideElement
              const isLive =
                liveSlide.class?.includes('has-livephoto') ||
                liveSlide.htmlEl?.querySelector?.('.fancybox-livephoto-container')
              if (isLive && index === curIndex) {
                initLivePhotoInteraction(liveSlide)
              }
            })
            carousel.on('change', (c: CarouselInstance, to: number, from?: number) => {
              if (from !== undefined) {
                const prevSlide = c.getSlides()[from] as FancyboxSlideElement
                if (prevSlide?.livePhotoPause) {
                  prevSlide.livePhotoPause()
                }
              }
              const curSlide = c.getSlides()[to] as FancyboxSlideElement
              if (curSlide) {
                setTimeout(() => {
                  const isLive =
                    curSlide.class?.includes('has-livephoto') ||
                    curSlide.htmlEl?.querySelector?.('.fancybox-livephoto-container')
                  if (isLive) {
                    if (curSlide.livePhotoCleanup) {
                      if (livePhotoAutoPlay.value) {
                        const container =
                          curSlide.el?.querySelector?.('.fancybox-livephoto-container') ||
                          curSlide.htmlEl?.querySelector?.('.fancybox-livephoto-container')
                        const video = container?.querySelector?.(
                          '.livephoto-video',
                        ) as HTMLVideoElement
                        if (container && video) {
                          container.classList.add('zoom')
                          video.currentTime = 0
                          video.play().catch(() => {})
                        }
                      }
                    } else {
                      initLivePhotoInteraction(curSlide)
                    }
                  }
                }, 50)
              }
            })
          },
          destroy: (fancybox: FancyboxInstance) => {
            const carousel = fancybox.getCarousel()
            if (carousel) {
              carousel.getSlides().forEach((slide: CarouselSlide) => {
                cleanupLivePhoto(slide as FancyboxSlideElement)
              })
            }
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
