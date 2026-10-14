// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

export interface LivePhotoPair {
  imageIndex: number
  videoIndex: number
  pairId: string
}

const FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70] as const
const MIN_EMBEDDED_FILE_SIZE = 1024 * 1024
const SEARCH_START_PERCENTAGE = 0.05
const MP4_BOX_HEADER_SIZE = 4

function findFtypPosition(uint8Array: Uint8Array, ftypSignature: readonly number[]): number {
  const searchStart = Math.floor(uint8Array.length * SEARCH_START_PERCENTAGE)
  const searchEnd = uint8Array.length - 8

  for (let i = searchStart; i < searchEnd; i++) {
    if (
      uint8Array[i] === ftypSignature[0] &&
      uint8Array[i + 1] === ftypSignature[1] &&
      uint8Array[i + 2] === ftypSignature[2] &&
      uint8Array[i + 3] === ftypSignature[3]
    ) {
      if (i >= MP4_BOX_HEADER_SIZE) {
        return i
      }
    }
  }

  return -1
}

export async function detectEmbeddedMotionPhoto(file: File): Promise<{
  isEmbedded: boolean
  ftypPosition?: number
  uint8Array?: Uint8Array
}> {
  try {
    const lowerName = file.name.toLowerCase()
    const isJpeg =
      file.type.startsWith('image/jpeg') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg')
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif')

    if (!isJpeg && !isHeic) {
      return { isEmbedded: false }
    }

    if (file.size < MIN_EMBEDDED_FILE_SIZE) {
      return { isEmbedded: false }
    }

    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const ftypPosition = findFtypPosition(uint8Array, FTYP_SIGNATURE)

    if (ftypPosition !== -1) {
      return {
        isEmbedded: true,
        ftypPosition,
        uint8Array,
      }
    }

    return { isEmbedded: false }
  } catch {
    return { isEmbedded: false }
  }
}

export async function isEmbeddedMotionPhoto(file: File): Promise<boolean> {
  const result = await detectEmbeddedMotionPhoto(file)
  return result.isEmbedded
}

export async function separateEmbeddedMotionPhoto(
  file: File,
  ftypPosition?: number,
  uint8Array?: Uint8Array,
): Promise<{ imageFile: File; videoFile: File } | null> {
  try {
    let fileData = uint8Array
    if (!fileData) {
      const arrayBuffer = await file.arrayBuffer()
      fileData = new Uint8Array(arrayBuffer)
    }

    let ftypPos = ftypPosition
    if (ftypPos === undefined) {
      ftypPos = findFtypPosition(fileData, FTYP_SIGNATURE)
      if (ftypPos === -1) {
        return null
      }
    }

    const videoStartPos = ftypPos - MP4_BOX_HEADER_SIZE
    const imageData = fileData.slice(0, videoStartPos)
    const lowerName = file.name.toLowerCase()
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif')
    const imageType = isHeic ? 'image/heic' : 'image/jpeg'
    const imageExt = isHeic ? 'heic' : 'jpg'

    const imageBlob = new Blob([imageData], { type: imageType })
    const videoData = fileData.slice(videoStartPos)
    const videoBlob = new Blob([videoData], { type: 'video/mp4' })

    const originalName = file.name.replace(/\.[^/.]+$/, '')
    const imageFile = new File([imageBlob], `${originalName}.${imageExt}`, {
      type: imageType,
      lastModified: file.lastModified,
    })
    const videoFile = new File([videoBlob], `${originalName}.mp4`, {
      type: 'video/mp4',
      lastModified: file.lastModified,
    })

    return { imageFile, videoFile }
  } catch {
    return null
  }
}

export function getBaseName(filename: string): string {
  let name = filename.split('/').pop() || filename
  const queryIndex = name.indexOf('?')
  if (queryIndex !== -1) {
    name = name.substring(0, queryIndex)
  }
  const dotIndex = name.lastIndexOf('.')
  if (dotIndex !== -1) {
    name = name.substring(0, dotIndex)
  }
  return name.toLowerCase()
}

export function generatePairId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

export function detectLivePhotoPairs(files: File[]): LivePhotoPair[] {
  const pairs: LivePhotoPair[] = []
  const images: { index: number; baseName: string }[] = []
  const videos: { index: number; baseName: string }[] = []

  files.forEach((file, index) => {
    const baseName = getBaseName(file.name)
    const lowerName = file.name.toLowerCase()
    const isVideo =
      file.type.startsWith('video/') ||
      lowerName.endsWith('.mov') ||
      lowerName.endsWith('.mp4') ||
      lowerName.endsWith('.webm') ||
      lowerName.endsWith('.ogg')
    const isImage =
      !isVideo &&
      (file.type.startsWith('image/') ||
        lowerName.endsWith('.jpg') ||
        lowerName.endsWith('.jpeg') ||
        lowerName.endsWith('.png') ||
        lowerName.endsWith('.heic') ||
        lowerName.endsWith('.heif') ||
        lowerName.endsWith('.webp'))

    if (isImage) {
      images.push({ index, baseName })
    } else if (isVideo) {
      videos.push({ index, baseName })
    }
  })

  for (const img of images) {
    for (const vid of videos) {
      if (img.baseName === vid.baseName && img.baseName !== '') {
        pairs.push({
          imageIndex: img.index,
          videoIndex: vid.index,
          pairId: generatePairId(),
        })
        break
      }
    }
  }

  return pairs
}

export interface LivePhotoMediaItem {
  id?: string | number
  url?: string
  image_url?: string
  media_url?: string
  media_type?: string
  category?: string
  name?: string
  key?: string
  content_type?: string
  live_video_id?: number | string
  live_pair_id?: string
  live_video_url?: string
  is_live_photo?: boolean
  width?: number
  height?: number
  size?: number
  storage_type?: string
  echo_id?: string
  [key: string]: unknown
}

export function getStorageKeyPrefix(str?: string): string {
  if (!str) return ''
  const filename = str.split('?')[0].split('#')[0].split('/').pop() || ''
  const match = filename.match(/^([a-zA-Z0-9]+_\d{8,12}_)/i)
  return match ? match[1].toLowerCase() : ''
}

export function parseKeyTimestampAndUID(str?: string): { uid: string; timestamp: number } | null {
  if (!str) return null
  const filename = str.split('?')[0].split('#')[0].split('/').pop() || ''
  const match = filename.match(/^([a-zA-Z0-9]+)_(\d{8,12})_/i)
  if (!match) return null
  const timestamp = parseInt(match[2], 10)
  if (Number.isNaN(timestamp)) return null
  return { uid: match[1].toLowerCase(), timestamp }
}

export function isVideoMediaItem(item: LivePhotoMediaItem): boolean {
  if (item.category === 'video' || item.media_type === 'video') return true
  const urlOrKey = String(item.url || item.key || item.name || '').toLowerCase()
  const clean = urlOrKey.split('?')[0].split('#')[0]
  if (
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.ogg')
  ) {
    return true
  }
  if (typeof item.content_type === 'string' && item.content_type.startsWith('video/')) {
    return true
  }
  return false
}

export function isImageMediaItem(item: LivePhotoMediaItem): boolean {
  if (isVideoMediaItem(item)) return false
  if (item.category === 'image' || item.media_type === 'image') return true
  const urlOrKey = String(item.url || item.key || item.name || '').toLowerCase()
  const clean = urlOrKey.split('?')[0].split('#')[0]
  if (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif') ||
    clean.endsWith('.heic') ||
    clean.endsWith('.heif')
  ) {
    return true
  }
  if (typeof item.content_type === 'string' && item.content_type.startsWith('image/')) {
    return true
  }
  return true
}

export function findCompanionVideo<T extends LivePhotoMediaItem = LivePhotoMediaItem>(
  image: T,
  videos: T[],
  allMedia?: T[],
): T | null {
  if (!videos || videos.length === 0) return null

  // 1. Explicit ID association
  if (image.live_video_id) {
    const found = videos.find((v) => String(v.id) === String(image.live_video_id))
    if (found) return found
  }

  // 2. Explicit Pair ID association
  if (image.live_pair_id) {
    const found = videos.find((v) => v.live_pair_id === image.live_pair_id)
    if (found) return found
  }

  // Only consider videos that are not bound to a different live_pair_id
  const eligibleVideos = videos.filter((v) => {
    if (v.live_pair_id && v.live_pair_id !== image.live_pair_id) return false
    return true
  })
  if (eligibleVideos.length === 0) return null

  const imgBase = getBaseName(String(image.name || image.key || image.url || ''))
  const imgPrefix = getStorageKeyPrefix(String(image.key || image.url || image.name || ''))
  const imgKeyInfo = parseKeyTimestampAndUID(String(image.key || image.url || image.name || ''))

  // 3. Basename match (e.g. IMG_1234.HEIC and IMG_1234.MOV)
  if (imgBase) {
    const found = eligibleVideos.find((v) => {
      const vidBase = getBaseName(String(v.name || v.key || v.url || ''))
      return vidBase && vidBase === imgBase
    })
    if (found) return found
  }

  // 4. Storage key timestamp prefix match (e.g. "1_1765048483_7bea62.PNG" and "1_1765048483_4df192.MOV")
  if (imgPrefix) {
    const found = eligibleVideos.find((v) => {
      const vidPrefix = getStorageKeyPrefix(String(v.key || v.url || v.name || ''))
      return vidPrefix && vidPrefix === imgPrefix
    })
    if (found) return found
  }

  // 5. Storage key timestamp proximity match (same user, within 3 seconds)
  if (imgKeyInfo) {
    const found = eligibleVideos.find((v) => {
      const vidKeyInfo = parseKeyTimestampAndUID(String(v.key || v.url || v.name || ''))
      if (!vidKeyInfo) return false
      return (
        vidKeyInfo.uid === imgKeyInfo.uid &&
        Math.abs(vidKeyInfo.timestamp - imgKeyInfo.timestamp) <= 3
      )
    })
    if (found) return found
  }

  // 6. 1:1 Fallback when there is only 1 video and 1 image in total
  if (allMedia) {
    const totalImages = allMedia.filter(isImageMediaItem)
    const totalVideos = allMedia.filter(isVideoMediaItem)
    if (totalImages.length === 1 && totalVideos.length === 1 && eligibleVideos.length === 1) {
      return eligibleVideos[0]
    }
  }

  return null
}

export function isLivePhoto(item: LivePhotoMediaItem, allMedia?: LivePhotoMediaItem[]): boolean {
  if (item.is_live_photo) return true
  if (item.live_video_url) return true
  if (
    item.live_video_id !== undefined &&
    item.live_video_id !== '' &&
    item.live_video_id !== 0 &&
    item.live_video_id !== '0'
  ) {
    return true
  }
  if (item.live_pair_id && allMedia) {
    const hasPair = allMedia.some(
      (m) => isVideoMediaItem(m) && m.live_pair_id === item.live_pair_id,
    )
    if (hasPair) return true
  }
  if (allMedia && isImageMediaItem(item)) {
    const videos = allMedia.filter(isVideoMediaItem)
    if (videos.length > 0 && findCompanionVideo(item, videos, allMedia)) {
      return true
    }
  }
  return false
}

export function isLivePhotoVideo(
  item: LivePhotoMediaItem,
  allMedia?: LivePhotoMediaItem[],
): boolean {
  if (!allMedia || allMedia.length === 0) return false
  if (!isVideoMediaItem(item)) return false

  if (item.live_pair_id) {
    return allMedia.some((m) => isImageMediaItem(m) && m.live_pair_id === item.live_pair_id)
  }

  if (item.id) {
    const hasLinkedImage = allMedia.some(
      (m) => isImageMediaItem(m) && String(m.live_video_id) === String(item.id),
    )
    if (hasLinkedImage) return true
  }

  const images = allMedia.filter(isImageMediaItem)
  const videos = allMedia.filter(isVideoMediaItem)
  for (const img of images) {
    const companion = findCompanionVideo(img, videos)
    if (companion && (companion === item || (companion.id && companion.id === item.id))) {
      return true
    }
  }

  return false
}

export interface PairedEchoFiles<T extends LivePhotoMediaItem = LivePhotoMediaItem> {
  imageFiles: T[]
  videoFiles: T[]
  audioFiles: T[]
  hasLivePhoto: boolean
}

export function pairEchoFiles<T extends LivePhotoMediaItem = LivePhotoMediaItem>(
  allFiles: T[],
  resolveUrlFn?: (item: T) => string,
): PairedEchoFiles<T> {
  const audioFiles: T[] = []
  const candidatesImages: T[] = []
  const candidatesVideos: T[] = []

  for (const f of allFiles) {
    if (
      f.category === 'audio' ||
      (typeof f.content_type === 'string' && f.content_type.startsWith('audio/'))
    ) {
      audioFiles.push(f)
    } else if (isVideoMediaItem(f)) {
      candidatesVideos.push(f)
    } else {
      candidatesImages.push(f)
    }
  }

  const pairedVideoIds = new Set<string | number>()
  const imageFiles: T[] = []
  const availableVideos = [...candidatesVideos]

  for (const img of candidatesImages) {
    const companion = findCompanionVideo(img, availableVideos)
    if (companion) {
      const companionKey = companion.id || companion.url || companion.key || ''
      pairedVideoIds.add(companionKey)
      const idx = availableVideos.indexOf(companion)
      if (idx !== -1) {
        availableVideos.splice(idx, 1)
      }

      const companionUrl = resolveUrlFn
        ? resolveUrlFn(companion)
        : String(companion.url || companion.media_url || companion.image_url || '')

      imageFiles.push({
        ...img,
        is_live_photo: true,
        live_video_id: companion.id,
        live_video_url: companionUrl,
      })
    } else {
      imageFiles.push({
        ...img,
        is_live_photo: Boolean(img.is_live_photo || img.live_video_url),
      })
    }
  }

  const standaloneVideos = candidatesVideos.filter(
    (v) => !pairedVideoIds.has(v.id || v.url || v.key || ''),
  )

  return {
    imageFiles,
    videoFiles: standaloneVideos,
    audioFiles,
    hasLivePhoto: pairedVideoIds.size > 0,
  }
}
