// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { describe, expect, it } from 'vitest'
import { useTimeDisplay } from '@/composables/useTimeDisplay'

describe('useTimeDisplay', () => {
  it('toggles time format and persists state', () => {
    const { isDetailed, toggleTimeDisplay, formatDisplayTime } = useTimeDisplay()

    const initial = isDetailed.value
    toggleTimeDisplay()
    expect(isDetailed.value).toBe(!initial)

    const testDate = new Date('2026-05-20T14:30:00Z').toISOString()
    const formatted = formatDisplayTime(testDate)
    expect(typeof formatted).toBe('string')
    expect(formatted.length).toBeGreaterThan(0)

    // Toggle back
    toggleTimeDisplay()
    expect(isDetailed.value).toBe(initial)
  })
})
