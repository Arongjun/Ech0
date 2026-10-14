// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

export interface LivePhotoPair {
  imageIndex: number
  videoIndex: number
  pairId: string
}

const FTYP_SIGNATURE = [0x66, 0x74, 0x79, 0x70] as const
const WIDE_SIGNATURE = [0x77, 0x69, 0x64, 0x65] as const
const MOOV_SIGNATURE = [0x6d, 0x6f, 0x6f, 0x76] as const
const MIN_EMBEDDED_FILE_SIZE = 512 * 1024
const MP4_BOX_HEADER_SIZE = 4

export interface VideoFormatInfo {
  mimeType: 'video/quicktime' | 'video/mp4'
  ext: 'mov' | 'mp4'
}

function isValidVideoBox(data: Uint8Array, pos: number): boolean {
  if (pos < 0 || pos >= data.length - 8) return false
  const b0 = data[pos + 4]
  const b1 = data[pos + 5]
  const b2 = data[pos + 6]
  const b3 = data[pos + 7]

  if (b0 === 0x66 && b1 === 0x74 && b2 === 0x79 && b3 === 0x70) return true
  if (b0 === 0x77 && b1 === 0x69 && b2 === 0x64 && b3 === 0x65) return true
  if (b0 === 0x6d && b1 === 0x6f && b2 === 0x6f && b3 === 0x76) return true

  return false
}

function findVideoOffsetFromXmp(data: Uint8Array): number | null {
  try {
    const scanLen = Math.min(data.length, 512 * 1024)
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data.subarray(0, scanLen))

    const mvo =
      text.match(/(?:GCamera:)?MicroVideoOffset\s*=\s*["']?(\d+)["']?/i) ||
      text.match(/<(?:GCamera:)?MicroVideoOffset>(\d+)<\/(?:GCamera:)?MicroVideoOffset>/i)
    if (mvo) {
      const offset = parseInt(mvo[1], 10)
      if (offset > 0 && offset < data.length) {
        const candidate = data.length - offset
        if (isValidVideoBox(data, candidate)) return candidate
        if (isValidVideoBox(data, candidate - MP4_BOX_HEADER_SIZE)) return candidate - MP4_BOX_HEADER_SIZE
        return candidate
      }
    }

    const itemLen =
      text.match(/(?:Item:)?Length\s*=\s*["']?(\d+)["']?/i) ||
      text.match(/<(?:[a-zA-Z0-9]+:)?Length>(\d+)<\/(?:[a-zA-Z0-9]+:)?Length>/i)
    if (itemLen) {
      const offset = parseInt(itemLen[1], 10)
      if (offset > 0 && offset < data.length) {
        const candidate = data.length - offset
        if (isValidVideoBox(data, candidate)) return candidate
        if (isValidVideoBox(data, candidate - MP4_BOX_HEADER_SIZE)) return candidate - MP4_BOX_HEADER_SIZE
        return candidate
      }
    }

    const mpl =
      text.match(/MotionPhotoLength\s*=\s*["']?(\d+)["']?/i) ||
      text.match(/MotionPhoto_Data\s*=\s*["']?(\d+)["']?/i) ||
      text.match(/DataLength\s*=\s*["']?(\d+)["']?/i)
    if (mpl) {
      const offset = parseInt(mpl[1], 10)
      if (offset > 0 && offset < data.length) {
        const candidate = data.length - offset
        if (isValidVideoBox(data, candidate)) return candidate
        if (isValidVideoBox(data, candidate - MP4_BOX_HEADER_SIZE)) return candidate - MP4_BOX_HEADER_SIZE
        return candidate
      }
    }
  } catch {
    // Ignore XMP decode errors
  }
  return null
}

function findEmbeddedVideoStart(uint8Array: Uint8Array, isHeic: boolean): number {
  const xmpPos = findVideoOffsetFromXmp(uint8Array)
  if (xmpPos !== null && xmpPos >= 32 && xmpPos < uint8Array.length - 8) {
    return xmpPos
  }

  let searchStart = 2
  if (isHeic) {
    if (uint8Array.length >= 8) {
      const firstBoxSize =
        ((uint8Array[0] << 24) |
          (uint8Array[1] << 16) |
          (uint8Array[2] << 8) |
          uint8Array[3]) >>>
        0
      searchStart = Math.max(32, Math.min(firstBoxSize, 256))
    } else {
      searchStart = 32
    }
  }

  const searchEnd = uint8Array.length - 8

  for (let i = searchStart; i < searchEnd; i++) {
    if (
      uint8Array[i] === FTYP_SIGNATURE[0] &&
      uint8Array[i + 1] === FTYP_SIGNATURE[1] &&
      uint8Array[i + 2] === FTYP_SIGNATURE[2] &&
      uint8Array[i + 3] === FTYP_SIGNATURE[3]
    ) {
      if (i >= MP4_BOX_HEADER_SIZE) {
        const boxSize =
          ((uint8Array[i - 4] << 24) |
            (uint8Array[i - 3] << 16) |
            (uint8Array[i - 2] << 8) |
            uint8Array[i - 1]) >>>
          0
        if (boxSize >= 8 && boxSize <= 1024) {
          return i - MP4_BOX_HEADER_SIZE
        }
      }
    }

    if (
      uint8Array[i] === WIDE_SIGNATURE[0] &&
      uint8Array[i + 1] === WIDE_SIGNATURE[1] &&
      uint8Array[i + 2] === WIDE_SIGNATURE[2] &&
      uint8Array[i + 3] === WIDE_SIGNATURE[3]
    ) {
      if (i >= MP4_BOX_HEADER_SIZE) {
        if (
          uint8Array[i - 4] === 0x00 &&
          uint8Array[i - 3] === 0x00 &&
          uint8Array[i - 2] === 0x00 &&
          uint8Array[i - 1] === 0x08
        ) {
          return i - MP4_BOX_HEADER_SIZE
        }
      }
    }

    if (
      uint8Array[i] === MOOV_SIGNATURE[0] &&
      uint8Array[i + 1] === MOOV_SIGNATURE[1] &&
      uint8Array[i + 2] === MOOV_SIGNATURE[2] &&
      uint8Array[i + 3] === MOOV_SIGNATURE[3]
    ) {
      if (i >= MP4_BOX_HEADER_SIZE) {
        const boxSize =
          ((uint8Array[i - 4] << 24) |
            (uint8Array[i - 3] << 16) |
            (uint8Array[i - 2] << 8) |
            uint8Array[i - 1]) >>>
          0
        if (boxSize >= 8) {
          return i - MP4_BOX_HEADER_SIZE
        }
      }
    }
  }

  return -1
}

export function detectVideoFormat(
  uint8Array: Uint8Array,
  videoStartPos: number,
  isHeicOrigin: boolean,
): VideoFormatInfo {
  const ftypPos = videoStartPos + MP4_BOX_HEADER_SIZE
  if (ftypPos + 8 <= uint8Array.length) {
    if (
      uint8Array[ftypPos] === WIDE_SIGNATURE[0] &&
      uint8Array[ftypPos + 1] === WIDE_SIGNATURE[1] &&
      uint8Array[ftypPos + 2] === WIDE_SIGNATURE[2] &&
      uint8Array[ftypPos + 3] === WIDE_SIGNATURE[3]
    ) {
      return { mimeType: 'video/quicktime', ext: 'mov' }
    }

    if (
      uint8Array[ftypPos] === FTYP_SIGNATURE[0] &&
      uint8Array[ftypPos + 1] === FTYP_SIGNATURE[1] &&
      uint8Array[ftypPos + 2] === FTYP_SIGNATURE[2] &&
      uint8Array[ftypPos + 3] === FTYP_SIGNATURE[3]
    ) {
      const b0 = uint8Array[ftypPos + 4]
      const b1 = uint8Array[ftypPos + 5]
      if (b0 === 0x71 && b1 === 0x74) {
        return { mimeType: 'video/quicktime', ext: 'mov' }
      }
    }
  }

  if (isHeicOrigin) {
    return { mimeType: 'video/quicktime', ext: 'mov' }
  }

  return { mimeType: 'video/mp4', ext: 'mp4' }
}

export async function detectEmbeddedMotionPhoto(file: File): Promise<{
  isEmbedded: boolean
  videoStartPos?: number
  ftypPosition?: number
  videoType?: VideoFormatInfo
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
      file.type === 'image/heic-sequence' ||
      file.type === 'image/heif-sequence' ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif') ||
      lowerName.endsWith('.hif')

    if (!isJpeg && !isHeic) {
      return { isEmbedded: false }
    }

    if (file.size < MIN_EMBEDDED_FILE_SIZE) {
      return { isEmbedded: false }
    }

    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const videoStartPos = findEmbeddedVideoStart(uint8Array, isHeic)

    if (videoStartPos !== -1) {
      const ftypPosition = videoStartPos + MP4_BOX_HEADER_SIZE
      const videoType = detectVideoFormat(uint8Array, videoStartPos, isHeic)
      return {
        isEmbedded: true,
        videoStartPos,
        ftypPosition,
        videoType,
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
  startOrFtypPos?: number,
  uint8Array?: Uint8Array,
  videoFormat?: VideoFormatInfo,
): Promise<{ imageFile: File; videoFile: File } | null> {
  try {
    let fileData = uint8Array
    if (!fileData) {
      const arrayBuffer = await file.arrayBuffer()
      fileData = new Uint8Array(arrayBuffer)
    }

    const lowerName = file.name.toLowerCase()
    const isHeic =
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.type === 'image/heic-sequence' ||
      file.type === 'image/heif-sequence' ||
      lowerName.endsWith('.heic') ||
      lowerName.endsWith('.heif') ||
      lowerName.endsWith('.hif')

    let videoStartPos: number
    if (startOrFtypPos === undefined) {
      videoStartPos = findEmbeddedVideoStart(fileData, isHeic)
      if (videoStartPos === -1) {
        return null
      }
    } else {
      if (
        startOrFtypPos >= MP4_BOX_HEADER_SIZE &&
        startOrFtypPos + 3 < fileData.length &&
        fileData[startOrFtypPos] === FTYP_SIGNATURE[0] &&
        fileData[startOrFtypPos + 1] === FTYP_SIGNATURE[1] &&
        fileData[startOrFtypPos + 2] === FTYP_SIGNATURE[2] &&
        fileData[startOrFtypPos + 3] === FTYP_SIGNATURE[3]
      ) {
        videoStartPos = startOrFtypPos - MP4_BOX_HEADER_SIZE
      } else {
        videoStartPos = startOrFtypPos
      }
    }

    if (videoStartPos <= 0 || videoStartPos >= fileData.length) {
      return null
    }

    const imageData = fileData.slice(0, videoStartPos)
    const videoData = fileData.slice(videoStartPos)

    const imageType = isHeic ? (file.type || 'image/heic') : 'image/jpeg'
    let imageExt = 'jpg'
    if (lowerName.endsWith('.heic')) imageExt = 'heic'
    else if (lowerName.endsWith('.heif')) imageExt = 'heif'
    else if (lowerName.endsWith('.hif')) imageExt = 'hif'
    else if (isHeic) imageExt = 'heic'

    const vFormat = videoFormat || detectVideoFormat(fileData, videoStartPos, isHeic)

    const imageBlob = new Blob([imageData], { type: imageType })
    const videoBlob = new Blob([videoData], { type: vFormat.mimeType })

    const originalName = file.name.replace(/\.[^/.]+$/, '')
    const imageFile = new File([imageBlob], `${originalName}.${imageExt}`, {
      type: imageType,
      lastModified: file.lastModified,
    })
    const videoFile = new File([videoBlob], `${originalName}.${vFormat.ext}`, {
      type: vFormat.mimeType,
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
        lowerName.endsWith('.hif') ||
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
    clean.endsWith('.heif') ||
    clean.endsWith('.hif')
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
