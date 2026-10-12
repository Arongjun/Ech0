// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import 'virtual:uno.css'
import '@/themes/index.scss'
import '@/themes/arong-ios-glass-pro.css'
import 'floating-vue/dist/style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import FloatingVue from 'floating-vue'

import App from './App.vue'
import router from './router'
import { initStores } from './stores/store-init'
import { useSettingStore } from './stores/setting'
import { useInitStore } from './stores/init'
import { setupI18n } from './locales'

import BaseDialog from '@/components/common/BaseDialog.vue'

const DEFAULT_LOADER_SITE_TITLE = 'Ech0'
const LOADER_SITE_TITLE_STORAGE_KEY = 'ech0:loader-site-title'

const normalizeLoaderSiteTitle = (...values: unknown[]) => {
  for (const value of values) {
    const title = String(value ?? '').trim()
    if (title) return title
  }
  return DEFAULT_LOADER_SITE_TITLE
}

const setStartupLoaderSiteTitle = (title: string) => {
  try {
    const normalized = normalizeLoaderSiteTitle(title)
    const loaderBrand =
      document.getElementById('app-loader-brand') ??
      document.querySelector<HTMLElement>('#app-loader .loader-brand')
    if (loaderBrand) {
      loaderBrand.textContent = normalized
    }
    if (normalized && normalized !== DEFAULT_LOADER_SITE_TITLE) {
      document.title = normalized
      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]')
      if (appleTitle) appleTitle.setAttribute('content', normalized)
    }
  } catch (_) {
    // Ignore DOM update errors
  }
}

const getCachedStartupLoaderSiteTitle = () => {
  try {
    return window.localStorage.getItem(LOADER_SITE_TITLE_STORAGE_KEY) || ''
  } catch {
    return ''
  }
}

const cacheStartupLoaderSiteTitle = (title: string) => {
  try {
    window.localStorage.setItem(LOADER_SITE_TITLE_STORAGE_KEY, normalizeLoaderSiteTitle(title))
  } catch {
    // Ignore storage failures in private mode or locked-down browsers.
  }
}

const appLoader = document.getElementById('app-loader')
let loaderCleared = false
const clearStartupLoader = () => {
  if (loaderCleared) return
  loaderCleared = true
  try {
    appLoader?.remove()
  } catch (_) {}
  document.documentElement.classList.remove('app-loading')
}

const startLoaderFade = () => {
  if (!appLoader) {
    clearStartupLoader()
    return
  }
  window.requestAnimationFrame(() => {
    try {
      appLoader.classList.add('fade-out')
    } catch (_) {}
  })
  appLoader.addEventListener('transitionend', clearStartupLoader, { once: true })
  window.setTimeout(clearStartupLoader, 600)
}

async function bootstrap() {
  try {
    setStartupLoaderSiteTitle(getCachedStartupLoaderSiteTitle())

    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)

    await initStores().catch((e) => {
      console.error('Failed to initialize stores:', e)
    })

    const settingStore = useSettingStore()
    const initStore = useInitStore()
    const startupLoaderSiteTitle = normalizeLoaderSiteTitle(
      settingStore.SystemSetting.server_name,
      settingStore.SystemSetting.site_title,
    )
    setStartupLoaderSiteTitle(startupLoaderSiteTitle)
    cacheStartupLoaderSiteTitle(startupLoaderSiteTitle)
    // 站点未完成初始化时跳过站点默认语言，让 navigator 检测生效，避免部署者第一次打开就被锁成 zh-CN。
    const siteDefaultLocale = initStore.initialized
      ? settingStore.SystemSetting.default_locale
      : undefined
    const i18n = await setupI18n(siteDefaultLocale).catch((e) => {
      console.error('Failed to setup i18n:', e)
      return undefined
    })

    app.use(router)
    if (i18n) {
      app.use(i18n)
    }
    app.use(FloatingVue, {
      themes: {
        tooltip: {
          triggers: ['hover'],
          hideTriggers: ['hover', 'click', 'touch'],
          placement: 'top',
          delay: { show: 300, hide: 80 },
          distance: 10,
          container: 'body',
          noAutoFocus: true,
          autoHide: true,
        },
      },
    })

    app.component('BaseDialog', BaseDialog)

    app.mount('#app')
  } catch (err) {
    console.error('Failed to bootstrap application:', err)
  } finally {
    const loaderTimeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 2000)
    })
    Promise.race([router.isReady().catch(() => undefined), loaderTimeout]).then(() => {
      startLoaderFade()
    })
  }
}

bootstrap()
