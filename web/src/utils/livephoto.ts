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
const SEARCH_END_PERCENTAGE = 0.8
const MP4_BOX_HEADER_SIZE = 4

function findFtypPosition(uint8Array: Uint8Array, ftypSignature: readonly number[]): number {
  const searchStart = Math.floor(uint8Array.length * SEARCH_START_PERCENTAGE)
  const searchEnd = Math.floor(uint8Array.length * SEARCH_END_PERCENTAGE)

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
    if (!file.type.startsWith('image/jpeg') && !file.name.toLowerCase().endsWith('.jpg')) {
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
    const imageBlob = new Blob([imageData], { type: 'image/jpeg' })

    const videoData = fileData.slice(videoStartPos)
    const videoBlob = new Blob([videoData], { type: 'video/mp4' })

    const originalName = file.name.replace(/\.[^/.]+$/, '')
    const imageFile = new File([imageBlob], `${originalName}.jpg`, {
      type: 'image/jpeg',
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
    if (file.type.startsWith('image/')) {
      images.push({ index, baseName })
    } else if (file.type.startsWith('video/')) {
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
  live_video_id?: number | string
  live_pair_id?: string
}

export function isLivePhoto(item: LivePhotoMediaItem, allMedia?: LivePhotoMediaItem[]): boolean {
  if (item.live_video_id) return true
  if (item.live_pair_id && allMedia) {
    return allMedia.some(
      (m) =>
        (m.category === 'video' || m.media_type === 'video') &&
        m.live_pair_id === item.live_pair_id,
    )
  }
  return false
}

export function isLivePhotoVideo(
  item: LivePhotoMediaItem,
  allMedia?: LivePhotoMediaItem[],
): boolean {
  if (!allMedia) return false
  if (item.category !== 'video' && item.media_type !== 'video') return false

  if (item.live_pair_id) {
    return allMedia.some(
      (m) =>
        (m.category === 'image' || m.media_type === 'image') &&
        m.live_pair_id === item.live_pair_id,
    )
  }

  if (item.id) {
    return allMedia.some((m) => String(m.live_video_id) === String(item.id))
  }

  return false
}
