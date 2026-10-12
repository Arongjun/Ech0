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
import { useThemeStore } from './stores/theme'
import { useInitStore } from './stores/init'
import { i18n, setupI18n } from './locales'

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
  } catch {
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
  } catch {}
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
    } catch {}
  })
  appLoader.addEventListener('transitionend', clearStartupLoader, { once: true })
  window.setTimeout(clearStartupLoader, 500)
}

async function bootstrap() {
  try {
    setStartupLoaderSiteTitle(getCachedStartupLoaderSiteTitle())

    const app = createApp(App)
    const pinia = createPinia()

    app.use(pinia)

    // Synchronously initialize theme styles immediately
    try {
      useThemeStore().init()
    } catch (e) {
      console.warn('Theme store init error:', e)
    }

    // Register Vue runtime error handler
    app.config.errorHandler = (err, instance, info) => {
      console.error('[Vue Runtime Error]:', err, info)
      if (typeof window !== 'undefined') {
        const w = window as Window & { __ech0ReportError?: (e: unknown, ctx: string) => void }
        w.__ech0ReportError?.(err, `Vue Error (${info})`)
      }
    }

    // Initialize i18n
    await setupI18n().catch((e) => {
      console.warn('Failed to setup i18n:', e)
    })
    app.use(i18n)

    // FloatingVue plugin installation (safely wrapped)
    try {
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
    } catch (e) {
      console.warn('Failed to install FloatingVue:', e)
    }

    app.use(router)
    app.component('BaseDialog', BaseDialog)

    // Mount application
    app.mount('#app')

    // Background store initialization - non-blocking
    initStores()
      .then(() => {
        const settingStore = useSettingStore()
        const initStore = useInitStore()
        const startupLoaderSiteTitle = normalizeLoaderSiteTitle(
          settingStore.SystemSetting.server_name,
          settingStore.SystemSetting.site_title,
        )
        setStartupLoaderSiteTitle(startupLoaderSiteTitle)
        cacheStartupLoaderSiteTitle(startupLoaderSiteTitle)

        if (initStore.initialized && settingStore.SystemSetting.default_locale) {
          setupI18n(settingStore.SystemSetting.default_locale).catch(() => undefined)
        }
      })
      .catch((e) => {
        console.warn('Background stores init failed:', e)
      })
  } catch (err) {
    console.error('Failed to bootstrap application:', err)
    if (typeof window !== 'undefined') {
      const w = window as Window & { __ech0ReportError?: (e: unknown, ctx: string) => void }
      w.__ech0ReportError?.(err, 'Bootstrap Error')
    }
  } finally {
    const loaderTimeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 800)
    })
    Promise.race([router.isReady().catch(() => undefined), loaderTimeout]).then(() => {
      startLoaderFade()
    })
  }
}

bootstrap()
