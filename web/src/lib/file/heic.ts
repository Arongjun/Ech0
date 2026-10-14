// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

const HEIC_EXTENSIONS = ['.heic', '.heif']
const HEIC_MIME_TYPES = ['image/heic', 'image/heif']

export function isHeicFile(file: File): boolean {
  const type = (file.type || '').toLowerCase()
  if (HEIC_MIME_TYPES.includes(type)) {
    return true
  }
  const name = (file.name || '').toLowerCase()
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext))
}

export function replaceHeicExtension(filename: string): string {
  return filename.replace(/\.(heic|heif)$/i, '.jpg')
}

export interface ConvertHeicOptions {
  quality?: number
}

export async function convertHeicFile(file: File, options?: ConvertHeicOptions): Promise<File> {
  if (!isHeicFile(file)) {
    return file
  }

  const { default: heic2any } = await import('heic2any')
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: options?.quality ?? 0.88,
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
