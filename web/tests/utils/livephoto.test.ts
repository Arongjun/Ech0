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

  it('detects and separates embedded motion photo files', async () => {
    const totalSize = 1024 * 1024 + 1000
    const buffer = new Uint8Array(totalSize)
    const ftypPos = Math.floor(totalSize * 0.4)

    // Put MP4 box header: 4-byte box size (0x00, 0x00, 0x00, 0x20) + 'ftyp'
    buffer[ftypPos - 4] = 0x00
    buffer[ftypPos - 3] = 0x00
    buffer[ftypPos - 2] = 0x00
    buffer[ftypPos - 1] = 0x20
    buffer[ftypPos] = 0x66
    buffer[ftypPos + 1] = 0x74
    buffer[ftypPos + 2] = 0x79
    buffer[ftypPos + 3] = 0x70

    const motionFile = new File([buffer], 'motion_shot.jpg', { type: 'image/jpeg' })
    const { detectEmbeddedMotionPhoto, separateEmbeddedMotionPhoto } = await import(
      '@/utils/livephoto'
    )

    const detection = await detectEmbeddedMotionPhoto(motionFile)
    expect(detection.isEmbedded).toBe(true)
    expect(detection.ftypPosition).toBe(ftypPos)

    const result = await separateEmbeddedMotionPhoto(
      motionFile,
      detection.ftypPosition,
      detection.uint8Array,
    )
    expect(result).not.toBeNull()
    expect(result?.imageFile.name).toBe('motion_shot.jpg')
    expect(result?.videoFile.name).toBe('motion_shot.mp4')
    expect(result?.imageFile.type).toBe('image/jpeg')
    expect(result?.videoFile.type).toBe('video/mp4')
    expect(result?.imageFile.size).toBe(ftypPos - 4)
    expect(result?.videoFile.size).toBe(totalSize - (ftypPos - 4))
  })

  it('detects and separates HEIF dynamic photo into .heic and .mov companion video', async () => {
    const totalSize = 1024 * 1024 * 2
    const buffer = new Uint8Array(totalSize)

    // HEIC initial ftyp box at byte 0
    buffer[0] = 0x00
    buffer[1] = 0x00
    buffer[2] = 0x00
    buffer[3] = 0x18
    buffer[4] = 0x66
    buffer[5] = 0x74
    buffer[6] = 0x79
    buffer[7] = 0x70 // 'ftyp'
    // Brand 'heic'
    buffer[8] = 0x68
    buffer[9] = 0x65
    buffer[10] = 0x69
    buffer[11] = 0x63

    // Embedded video starts at 400KB (small image header, well before 5% of large file)
    const videoStart = 400 * 1024
    // QuickTime MOV brand 'qt  '
    buffer[videoStart] = 0x00
    buffer[videoStart + 1] = 0x00
    buffer[videoStart + 2] = 0x00
    buffer[videoStart + 3] = 0x20
    buffer[videoStart + 4] = 0x66
    buffer[videoStart + 5] = 0x74
    buffer[videoStart + 6] = 0x79
    buffer[videoStart + 7] = 0x70 // 'ftyp'
    buffer[videoStart + 8] = 0x71 // 'q'
    buffer[videoStart + 9] = 0x74 // 't'
    buffer[videoStart + 10] = 0x20 // ' '
    buffer[videoStart + 11] = 0x20 // ' '

    const heicFile = new File([buffer], 'IMG_2026.HEIC', { type: 'image/heic' })
    const { detectEmbeddedMotionPhoto, separateEmbeddedMotionPhoto } = await import(
      '@/utils/livephoto'
    )

    const detection = await detectEmbeddedMotionPhoto(heicFile)
    expect(detection.isEmbedded).toBe(true)
    expect(detection.videoStartPos).toBe(videoStart)
    expect(detection.videoType?.ext).toBe('mov')
    expect(detection.videoType?.mimeType).toBe('video/quicktime')

    const result = await separateEmbeddedMotionPhoto(
      heicFile,
      detection.videoStartPos,
      detection.uint8Array,
      detection.videoType,
    )
    expect(result).not.toBeNull()
    expect(result?.imageFile.name).toBe('IMG_2026.heic')
    expect(result?.videoFile.name).toBe('IMG_2026.mov')
    expect(result?.imageFile.type).toBe('image/heic')
    expect(result?.videoFile.type).toBe('video/quicktime')
    expect(result?.imageFile.size).toBe(videoStart)
    expect(result?.videoFile.size).toBe(totalSize - videoStart)
  })

  it('detects embedded motion photo via XMP metadata MicroVideoOffset', async () => {
    const totalSize = 1024 * 1024 * 3
    const buffer = new Uint8Array(totalSize)
    const videoLen = 1024 * 1024
    const videoStart = totalSize - videoLen

    // Put XMP XML text in header
    const xmpText = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description GCamera:MicroVideo="1" GCamera:MicroVideoOffset="${videoLen}"/></rdf:RDF></x:xmpmeta>`
    const enc = new TextEncoder().encode(xmpText)
    buffer.set(enc, 100)

    // Put video ftyp at videoStart
    buffer[videoStart] = 0x00
    buffer[videoStart + 1] = 0x00
    buffer[videoStart + 2] = 0x00
    buffer[videoStart + 3] = 0x20
    buffer[videoStart + 4] = 0x66
    buffer[videoStart + 5] = 0x74
    buffer[videoStart + 6] = 0x79
    buffer[videoStart + 7] = 0x70 // 'ftyp'

    const shotFile = new File([buffer], 'MVIMG_001.jpg', { type: 'image/jpeg' })
    const { detectEmbeddedMotionPhoto, separateEmbeddedMotionPhoto } = await import(
      '@/utils/livephoto'
    )

    const detection = await detectEmbeddedMotionPhoto(shotFile)
    expect(detection.isEmbedded).toBe(true)
    expect(detection.videoStartPos).toBe(videoStart)

    const result = await separateEmbeddedMotionPhoto(
      shotFile,
      detection.videoStartPos,
      detection.uint8Array,
      detection.videoType,
    )
    expect(result).not.toBeNull()
    expect(result?.imageFile.name).toBe('MVIMG_001.jpg')
    expect(result?.videoFile.name).toBe('MVIMG_001.mp4')
    expect(result?.imageFile.size).toBe(videoStart)
    expect(result?.videoFile.size).toBe(videoLen)
  })

  it('pairs 1 image and 1 video as fallback when basenames do not match', () => {
    const photo = new File(['img'], 'live0.jpeg', { type: 'image/jpeg' })
    const video = new File(['vid'], 'video.mov', { type: 'video/quicktime' })
    const pairs = detectLivePhotoPairs([photo, video])
    expect(pairs.length).toBe(1)
    expect(pairs[0].imageIndex).toBe(0)
    expect(pairs[0].videoIndex).toBe(1)
    expect(typeof pairs[0].pairId).toBe('string')
  })
})

