// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

declare module 'heic2any' {
  export interface Heic2AnyOptions {
    blob: Blob
    toType?: string
    quality?: number
    gifInterval?: number
    multiple?: boolean
  }

  export default function heic2any(options: Heic2AnyOptions): Promise<Blob | Blob[]>
}
