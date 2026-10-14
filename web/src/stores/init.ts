// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchGetInitStatus, fetchInitOwner } from '@/service/api'
import { i18n } from '@/locales'
import { localStg } from '@/utils/storage'

const INIT_ALREADY_DONE = 'INIT_ALREADY_DONE'
const INIT_OWNER_EXISTS = 'INIT_OWNER_EXISTS'

export const useInitStore = defineStore('initStore', () => {
  const cached = localStg.getItem<boolean>('initialized')
  const initialized = ref<boolean>(cached === true)
  const ownerExists = ref<boolean>(cached === true)
  const ready = ref<boolean>(cached === true)

  const saveCache = () => {
    localStg.setItem('initialized', initialized.value)
  }

  const clearCache = () => {
    localStg.removeItem('initialized')
  }

  const getStatus = async () => {
    try {
      const res = await fetchGetInitStatus()
      if (res.code === 1) {
        initialized.value = res.data.initialized
        ownerExists.value = res.data.owner_exists
        ready.value = true
        saveCache()
      } else if (!ready.value) {
        ready.value = false
        clearCache()
      }
      return res
    } catch (e) {
      if (!ready.value) {
        ready.value = false
      }
      throw e
    }
  }

  const initOwner = async (payload: App.Api.Auth.SignupParams) => {
    const enriched: App.Api.Auth.SignupParams = {
      ...payload,
      locale: payload.locale || String(i18n.global.locale.value),
    }
    const res = await fetchInitOwner(enriched)
    if (res.code === 1) {
      initialized.value = true
      ownerExists.value = true
      ready.value = true
      saveCache()
    } else if (res.error_code === INIT_ALREADY_DONE || res.error_code === INIT_OWNER_EXISTS) {
      initialized.value = true
      ownerExists.value = true
      ready.value = true
      saveCache()
    } else {
      await getStatus().catch(() => undefined)
    }
    return res
  }

  const init = async () => {
    const cachedInit = localStg.getItem<boolean>('initialized')
    if (cachedInit !== null) {
      initialized.value = cachedInit
      ready.value = cachedInit
    }
    await getStatus()
  }

  return {
    initialized,
    ownerExists,
    ready,
    getStatus,
    initOwner,
    init,
  }
})
