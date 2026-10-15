// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { onBeforeUnmount, ref, shallowRef, unref, type MaybeRef } from 'vue'
import router from '@/router'
import {
  Fancybox,
  type CarouselSlide,
  type FancyboxOptions,
  type FancyboxInstance,
  type CarouselInstance,
} from '@fancyapps/ui'
import { i18n } from '@/locales'
import { localStg } from '@/utils/storage'
import '@fancyapps/ui/dist/fancybox/fancybox.css'
import '@fancyapps/ui/dist/carousel/carousel.css'
import '@fancyapps/ui/dist/carousel/carousel.thumbs.css'
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

const livePhotoAutoPlay = ref<boolean>(localStg.getItem<string>('livePhotoAutoPlay') !== 'false')

export const toggleLivePhotoAutoPlay = () => {
  livePhotoAutoPlay.value = !livePhotoAutoPlay.value
  localStg.setItem('livePhotoAutoPlay', String(livePhotoAutoPlay.value))
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

interface LivePhotoSlideData {
  isLivePhoto?: boolean
  videoSrc?: string
  livePhotoInitialized?: boolean
  livePhotoVideo?: HTMLVideoElement | null
  livePhotoCleanup?: (() => void) | null
  livePhotoPause?: (() => void) | null
}

type FancyboxSlideElement = CarouselSlide & LivePhotoSlideData

const playLiveVideo = async (video: HTMLVideoElement, slideEl?: HTMLElement | null) => {
  try {
    video.currentTime = 0
    await video.play()
    slideEl?.classList.add('is-playing', 'zoom')
  } catch {
    try {
      video.muted = true
      await video.play()
      slideEl?.classList.add('is-playing', 'zoom')
    } catch (err) {
      console.warn('Live photo video play error:', err)
      slideEl?.classList.remove('is-playing', 'zoom')
    }
  }
}

const pauseLiveVideo = (video: HTMLVideoElement, slideEl?: HTMLElement | null) => {
  try {
    video.pause()
    slideEl?.classList.remove('is-playing', 'zoom')
  } catch {
    // ignore
  }
}

function initLivePhotoInteraction(slide: FancyboxSlideElement, shouldAutoPlay = false): void {
  try {
    if (!slide || !slide.videoSrc) return
    if (slide.livePhotoInitialized && slide.livePhotoVideo) {
      if (shouldAutoPlay && livePhotoAutoPlay.value) {
        playLiveVideo(slide.livePhotoVideo, slide.el)
      }
      return
    }

    const findElements = () => {
      const el = slide.el
      if (!el) return null
      const viewport =
        (typeof slide.panzoomRef?.getViewport === 'function'
          ? slide.panzoomRef.getViewport()
          : null) ||
        (el.querySelector('.f-panzoom__viewport') as HTMLElement | null) ||
        (el.querySelector('.f-panzoom__wrapper') as HTMLElement | null)
      const wrapper =
        (typeof slide.panzoomRef?.getWrapper === 'function'
          ? slide.panzoomRef.getWrapper()
          : null) ||
        (el.querySelector('.f-panzoom__wrapper') as HTMLElement | null) ||
        el
      return { el, viewport, wrapper }
    }

    const doInit = (el: HTMLElement, viewport: HTMLElement, wrapper: HTMLElement) => {
      if (slide.livePhotoInitialized) return

      let video = viewport.querySelector('.livephoto-video') as HTMLVideoElement | null
      if (!video) {
        video = document.createElement('video')
        video.className = 'livephoto-video'
        video.src = String(slide.videoSrc)
        video.preload = 'metadata'
        video.muted = true
        video.playsInline = true
        video.setAttribute('webkit-playsinline', 'true')
        video.setAttribute('disablepictureinpicture', 'true')
        viewport.appendChild(video)
      }

      let controlWrapper = wrapper.querySelector('.livephoto-control-wrapper') as HTMLElement | null
      if (!controlWrapper) {
        controlWrapper = document.createElement('div')
        controlWrapper.className = 'livephoto-control-wrapper'
        const autoPlayEnabled = livePhotoAutoPlay.value
        const autoPlayText = autoPlayEnabled
          ? t('imageGallery.turnOffAutoPlay', '关闭自动播放')
          : t('imageGallery.turnOnAutoPlay', '开启自动播放')

        controlWrapper.innerHTML = `
          <div class="livephoto-icon">
            <svg class="livephoto-icon-svg ${autoPlayEnabled ? '' : 'disabled'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/>
              <circle cx="12" cy="12" r="3" fill="currentColor"/>
              ${autoPlayEnabled ? '' : '<line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="1.5"/>'}
            </svg>
            <span class="livephoto-label">LIVE</span>
            <svg class="livephoto-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="livephoto-dropdown">
            <div class="livephoto-dropdown-item" data-action="toggle-autoplay">
              <span class="dropdown-text">${autoPlayText}</span>
              <svg class="dropdown-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="3" fill="currentColor"/>
                ${autoPlayEnabled ? '' : '<line x1="4" y1="4" x2="20" y2="20"/>'}
              </svg>
            </div>
          </div>
        `
        wrapper.appendChild(controlWrapper)
      }

      slide.livePhotoInitialized = true
      slide.livePhotoVideo = video

      const icon = controlWrapper.querySelector('.livephoto-icon') as HTMLElement | null
      const chevron = controlWrapper.querySelector('.livephoto-chevron') as HTMLElement | null
      const dropdown = controlWrapper.querySelector('.livephoto-dropdown') as HTMLElement | null
      const toggleAutoPlayButton = controlWrapper.querySelector('[data-action="toggle-autoplay"]')

      const handleVideoEnded = () => {
        el.classList.remove('is-playing', 'zoom')
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

      if (toggleAutoPlayButton) {
        toggleAutoPlayButton.addEventListener('click', (e) => {
          e.stopPropagation()
          toggleLivePhotoAutoPlay()
          const text = toggleAutoPlayButton.querySelector('.dropdown-text')
          const iconSvg = toggleAutoPlayButton.querySelector('.dropdown-icon')
          const mainIconSvg = icon?.querySelector('.livephoto-icon-svg')
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
          hideDropdown()
        })
      }

      let hasHoveredDropdown = false
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

      if (dropdown) {
        dropdown.addEventListener('mouseenter', () => {
          if (!isMobile()) hasHoveredDropdown = true
        })
      }

      if (chevron) {
        chevron.addEventListener('click', (e) => {
          toggleDropdown(e)
          hasHoveredDropdown = false
        })
      }

      if (icon) {
        icon.addEventListener('click', (e) => {
          e.stopPropagation()
          if (el.classList.contains('is-playing') && !video.paused) {
            pauseLiveVideo(video, el)
          } else {
            playLiveVideo(video, el)
          }
        })
        icon.addEventListener('mouseenter', () => {
          if (!isMobile()) playLiveVideo(video, el)
        })
        icon.addEventListener('mouseleave', () => {
          if (!isMobile()) pauseLiveVideo(video, el)
        })
      }

      const closeOnClickOutside = (e: MouseEvent) => {
        if (!controlWrapper?.contains(e.target as Node)) {
          hideDropdown()
          hasHoveredDropdown = false
          if (!isMobile()) hideChevron()
        }
      }
      document.addEventListener('click', closeOnClickOutside)

      // Mobile touch hold interaction on viewport
      let touchHoldTimer: ReturnType<typeof setTimeout> | null = null
      let isTouchHolding = false

      const handleTouchStart = (e: TouchEvent) => {
        if (controlWrapper?.contains(e.target as Node)) return
        isTouchHolding = false
        touchHoldTimer = setTimeout(() => {
          isTouchHolding = true
          playLiveVideo(video, el)
        }, 180)
      }

      const handleTouchEnd = (e: TouchEvent) => {
        if (controlWrapper?.contains(e.target as Node)) return
        if (touchHoldTimer) {
          clearTimeout(touchHoldTimer)
          touchHoldTimer = null
        }
        if (isTouchHolding) {
          isTouchHolding = false
          pauseLiveVideo(video, el)
        }
      }

      const handleTouchCancel = (e: TouchEvent) => {
        if (controlWrapper?.contains(e.target as Node)) return
        if (touchHoldTimer) {
          clearTimeout(touchHoldTimer)
          touchHoldTimer = null
        }
        isTouchHolding = false
        pauseLiveVideo(video, el)
      }

      viewport.addEventListener('touchstart', handleTouchStart, { passive: true })
      viewport.addEventListener('touchend', handleTouchEnd, { passive: true })
      viewport.addEventListener('touchcancel', handleTouchCancel, { passive: true })

      video.addEventListener('ended', handleVideoEnded)
      video.addEventListener('contextmenu', preventContextMenu, { passive: false })
      if (icon) icon.addEventListener('contextmenu', preventContextMenu, { passive: false })

      if (shouldAutoPlay && livePhotoAutoPlay.value) {
        setTimeout(() => {
          playLiveVideo(video, el)
        }, 200)
      }

      slide.livePhotoPause = () => {
        pauseLiveVideo(video, el)
        video.currentTime = 0
      }

      slide.livePhotoCleanup = () => {
        document.removeEventListener('click', closeOnClickOutside)
        viewport.removeEventListener('touchstart', handleTouchStart)
        viewport.removeEventListener('touchend', handleTouchEnd)
        viewport.removeEventListener('touchcancel', handleTouchCancel)
        video.removeEventListener('ended', handleVideoEnded)
        video.removeEventListener('contextmenu', preventContextMenu)
        if (icon) icon.removeEventListener('contextmenu', preventContextMenu)
        try {
          video.pause()
          video.removeAttribute('src')
          video.load()
        } catch {
          // ignore
        }
        video.remove()
        controlWrapper?.remove()
        el.classList.remove('is-playing', 'zoom')
        slide.livePhotoInitialized = false
        slide.livePhotoVideo = null
      }
    }

    let retries = 0
    const tryInit = () => {
      const els = findElements()
      if (els && els.viewport && els.wrapper) {
        doInit(els.el, els.viewport, els.wrapper)
      } else if (retries++ < 25) {
        window.requestAnimationFrame(tryInit)
      }
    }
    tryInit()
  } catch (error) {
    console.error('Live photo init error:', error)
  }
}

function cleanupLivePhoto(slide: FancyboxSlideElement): void {
  if (slide?.livePhotoCleanup) {
    try {
      slide.livePhotoCleanup()
    } catch {
      // ignore
    }
  }
  slide.livePhotoCleanup = null
  slide.livePhotoPause = null
  slide.livePhotoInitialized = false
  slide.livePhotoVideo = null
}

export function useMediaFancybox(
  defaultItems?: MaybeRef<MediaGalleryItem[]>,
  options?: UseMediaFancyboxOptions,
) {
  const activeInstance = shallowRef<ReturnType<typeof Fancybox.show> | null>(null)

  const unregisterRouterHook =
    typeof router?.afterEach === 'function' ? router.afterEach(() => close()) : null

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

      const slide: Partial<CarouselSlide> & {
        isLivePhoto?: boolean
        videoSrc?: string
      } = {
        src,
        thumb,
        thumbSrc: thumb,
        caption,
        alt,
        width: item.width,
        height: item.height,
        type: isVideo ? 'html5video' : 'image',
        isLivePhoto: isLive,
        videoSrc: isLive ? String(item.videoSrc) : undefined,
      }

      if (isLive) {
        slide.class = 'has-livephoto'
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
    const minThumbsCount = options?.minThumbsCount ?? 1

    try {
      const fancyboxOptions: Partial<FancyboxOptions> = {
        Hash: false,
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
          Arrows: slides.length > 1,
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

            // Only initialize the active slide to avoid exhausting mobile WebKit decoders
            const curSlide = carousel.getSlides()[curIndex] as FancyboxSlideElement
            if (curSlide?.isLivePhoto) {
              initLivePhotoInteraction(curSlide, true)
            }

            carousel.on('contentReady', (_c: CarouselInstance, slide: CarouselSlide) => {
              const liveSlide = slide as FancyboxSlideElement
              if (liveSlide?.isLivePhoto) {
                const activeSlide =
                  typeof fancybox.getSlide === 'function' ? fancybox.getSlide() : null
                const isCur = activeSlide
                  ? activeSlide.index === liveSlide.index
                  : liveSlide.index === curIndex
                if (isCur) {
                  initLivePhotoInteraction(liveSlide, true)
                }
              }
            })

            carousel.on('change', (c: CarouselInstance, to: number, from?: number) => {
              if (from !== undefined) {
                const prevSlide = c.getSlides()[from] as FancyboxSlideElement
                if (prevSlide?.isLivePhoto) {
                  cleanupLivePhoto(prevSlide)
                }
              }
              const curSlide = c.getSlides()[to] as FancyboxSlideElement
              if (curSlide?.isLivePhoto) {
                setTimeout(() => {
                  initLivePhotoInteraction(curSlide, true)
                }, 60)
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
    unregisterRouterHook?.()
    close()
  })

  return {
    open,
    close,
    destroy,
    activeInstance,
  }
}
