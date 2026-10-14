// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { ref } from 'vue'
import { localStg } from '@/utils/storage'
import { formatDate, formatDateTime } from '@/utils/other'

const TIME_DISPLAY_DETAILED_KEY = 'ech0_time_display_detailed'

const isDetailed = ref<boolean>(localStg.getItem<boolean>(TIME_DISPLAY_DETAILED_KEY) ?? false)

export function useTimeDisplay() {
  const toggleTimeDisplay = () => {
    isDetailed.value = !isDetailed.value
    localStg.setItem(TIME_DISPLAY_DETAILED_KEY, isDetailed.value)
  }

  const formatDisplayTime = (dateInput: string | number | null | undefined) => {
    if (isDetailed.value) {
      return formatDateTime(dateInput)
    }
    return formatDate(dateInput)
  }

  return {
    isDetailed,
    toggleTimeDisplay,
    formatDisplayTime,
  }
}
