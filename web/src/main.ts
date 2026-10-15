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
import { setupI18n } from './locales'

import BaseDialog from '@/components/common/BaseDialog.vue'

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
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
  window.setTimeout(clearStartupLoader, 600)
}

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  try {
    useThemeStore().init()
  } catch (e) {
    console.warn('Theme init error:', e)
  }

  const i18n = await setupI18n().catch((e) => {
    console.warn('Failed to setup i18n:', e)
    return undefined
  })
  if (i18n) {
    app.use(i18n)
  }

  app.use(router)
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

  app.config.errorHandler = (err, instance, info) => {
    console.error('[Vue App Error]', err, info)
  }

  try {
    await Promise.race([
      router.isReady(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2000)),
    ])
  } catch (err) {
    console.warn('Router isReady error:', err)
  }

  try {
    app.mount('#app')
  } catch (err) {
    console.error('Failed to mount application:', err)
  }

  window.requestAnimationFrame(() => {
    startLoaderFade()
  })

  window.setTimeout(startLoaderFade, 2500)

  initStores()
    .then(() => {
      const settingStore = useSettingStore()
      const initStore = useInitStore()
      if (initStore.initialized && settingStore.SystemSetting?.default_locale) {
        setupI18n(settingStore.SystemSetting.default_locale).catch(() => undefined)
      }
    })
    .catch((e) => {
      console.warn('Background stores init failed:', e)
    })
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err)
  startLoaderFade()
})
