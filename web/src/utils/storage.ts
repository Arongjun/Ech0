// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

export const localStg = {
  setItem<T>(key: string, obj: T) {
    try {
      localStorage.setItem(key, JSON.stringify(obj))
    } catch {
      // Ignore storage errors in restricted webviews (such as Mobile QQ/private browsing).
    }
  },

  getItem<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      if (!item) return null
      return JSON.parse(item) as T
    } catch {
      return null
    }
  },

  removeItem(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      // Ignore
    }
  },

  clear() {
    try {
      localStorage.clear()
    } catch {
      // Ignore
    }
  },
}
