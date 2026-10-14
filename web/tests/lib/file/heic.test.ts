// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { describe, expect, it } from 'vitest'
import { isHeicFile, replaceHeicExtension } from '@/lib/file/heic'

describe('heic', () => {
  it('identifies HEIC/HEIF files by MIME type or extension', () => {
    const heicByName = new File(['dummy'], 'IMG_1234.HEIC', { type: '' })
    const heifByName = new File(['dummy'], 'photo.heif', { type: '' })
    const heicByType = new File(['dummy'], 'photo.unknown', { type: 'image/heic' })
    const regularJpeg = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' })
    const regularPng = new File(['dummy'], 'photo.png', { type: 'image/png' })

    expect(isHeicFile(heicByName)).toBe(true)
    expect(isHeicFile(heifByName)).toBe(true)
    expect(isHeicFile(heicByType)).toBe(true)
    expect(isHeicFile(regularJpeg)).toBe(false)
    expect(isHeicFile(regularPng)).toBe(false)
  })

  it('replaces .heic and .heif extensions with .jpg', () => {
    expect(replaceHeicExtension('photo.HEIC')).toBe('photo.jpg')
    expect(replaceHeicExtension('my_image.heif')).toBe('my_image.jpg')
    expect(replaceHeicExtension('standard.png')).toBe('standard.png')
  })
})
