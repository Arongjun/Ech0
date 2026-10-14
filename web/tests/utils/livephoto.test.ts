// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { describe, expect, it } from 'vitest'
import {
  getBaseName,
  detectLivePhotoPairs,
  isLivePhoto,
  isLivePhotoVideo,
  pairEchoFiles,
} from '@/utils/livephoto'

describe('livephoto', () => {
  it('extracts base names without extensions or paths', () => {
    expect(getBaseName('/uploads/IMG_1234.JPG')).toBe('img_1234')
    expect(getBaseName('https://example.com/files/IMG_1234.mov?token=xyz')).toBe('img_1234')
    expect(getBaseName('my-vacation.heic')).toBe('my-vacation')
  })

  it('detects live photo pairs with matching base names', () => {
    const imgFile = new File(['image'], 'IMG_2026.jpg', { type: 'image/jpeg' })
    const vidFile = new File(['video'], 'IMG_2026.mov', { type: 'video/mp4' })
    const otherImg = new File(['other'], 'IMG_9999.jpg', { type: 'image/jpeg' })

    const pairs = detectLivePhotoPairs([imgFile, otherImg, vidFile])
    expect(pairs.length).toBe(1)
    expect(pairs[0].imageIndex).toBe(0)
    expect(pairs[0].videoIndex).toBe(2)
    expect(typeof pairs[0].pairId).toBe('string')
  })

  it('identifies live photos and live photo paired videos', () => {
    const photo = { id: '1', category: 'image', live_pair_id: 'pair-1' }
    const video = { id: '2', category: 'video', live_pair_id: 'pair-1' }
    const normalPhoto = { id: '3', category: 'image' }
    const all = [photo, video, normalPhoto]

    expect(isLivePhoto(photo, all)).toBe(true)
    expect(isLivePhoto(normalPhoto, all)).toBe(false)
    expect(isLivePhotoVideo(video, all)).toBe(true)
    expect(isLivePhotoVideo(photo, all)).toBe(false)
  })

  it('matches pairs by storage key prefix (timestamp match)', () => {
    const photo = {
      id: 'p1',
      key: '1_1765048483_7bea62.PNG',
      category: 'image',
      url: 'https://cos.example.com/1_1765048483_7bea62.PNG',
    }
    const video = {
      id: 'v1',
      key: '1_1765048483_4df192.MOV',
      category: 'video',
      url: 'https://cos.example.com/1_1765048483_4df192.MOV',
    }
    const otherPhoto = {
      id: 'p2',
      key: '1_1765049999_abcdef.PNG',
      category: 'image',
      url: 'https://cos.example.com/1_1765049999_abcdef.PNG',
    }

    const { imageFiles, videoFiles, hasLivePhoto } = pairEchoFiles([photo, otherPhoto, video])
    expect(hasLivePhoto).toBe(true)
    expect(videoFiles).toHaveLength(0)
    expect(imageFiles).toHaveLength(2)

    const livePhoto = imageFiles.find((f) => f.id === 'p1')
    expect(livePhoto?.is_live_photo).toBe(true)
    expect(livePhoto?.live_video_url).toBe('https://cos.example.com/1_1765048483_4df192.MOV')

    const regularPhoto = imageFiles.find((f) => f.id === 'p2')
    expect(regularPhoto?.is_live_photo).toBe(false)
  })
})

