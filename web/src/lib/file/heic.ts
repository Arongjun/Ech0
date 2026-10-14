// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

const HEIC_EXTENSIONS = ['.heic', '.heif', '.hif']
const HEIC_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]

export function isHeicFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (HEIC_MIME_TYPES.includes(type)) {
    return true
  }
  const name = (file.name || '').toLowerCase()
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function replaceHeicExtension(filename: string): string {
  return filename.replace(/\.(heic|heif|hif)$/i, '.jpg')
}

export interface ConvertHeicOptions {
  quality?: number
}

async function convertHeicViaCanvas(file: File, quality = 0.88): Promise<File> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0)
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
        )
        if (blob) {
          return new File([blob], replaceHeicExtension(file.name), {
            type: 'image/jpeg',
            lastModified: file.lastModified,
          })
        }
      }
    } catch {
      // Fall through to Image element
    }
  }

  return new Promise<File>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context not available'))
        return
      }
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(
              new File([blob], replaceHeicExtension(file.name), {
                type: 'image/jpeg',
                lastModified: file.lastModified,
              }),
            )
          } else {
            reject(new Error('Canvas toBlob failed'))
          }
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image failed to decode HEIC natively'))
    }
    img.src = url
  })
}

export async function convertHeicFile(file: File, options?: ConvertHeicOptions): Promise<File> {
  if (!isHeicFile(file)) {
    return file
  }

  const quality = options?.quality ?? 0.88

  // 1. First try native browser decoding (Safari / iOS WebKit natively supports HEIC fast and cleanly)
  try {
    return await convertHeicViaCanvas(file, quality)
  } catch {
    // Native decoding not supported (e.g. Chrome/Firefox on Windows), continue to heic2any
  }

  // 2. Fallback to heic2any WebAssembly decoder
  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality,
  })

  const blob = Array.isArray(converted) ? converted[0] : converted
  if (!blob) {
    throw new Error('HEIC conversion resulted in an empty blob')
  }

  const newName = replaceHeicExtension(file.name)
  return new File([blob], newName, {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  })
}

export async function convertHeicFilesIfNeeded(
  files: File[],
  onConverting?: () => void,
  onSuccess?: () => void,
  onError?: (err: unknown) => void,
): Promise<File[]> {
  const hasHeic = files.some(isHeicFile)
  if (!hasHeic) {
    return files
  }

  try {
    onConverting?.()
    const converted = await Promise.all(
      files.map(async (f) => {
        if (!isHeicFile(f)) return f
        try {
          return await convertHeicFile(f)
        } catch (err) {
          onError?.(err)
          return f
        }
      }),
    )
    onSuccess?.()
    return converted
  } catch (err) {
    onError?.(err)
    return files
  }
}
