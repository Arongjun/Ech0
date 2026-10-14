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

  await initStores().catch((e) => {
    console.error('Failed to initialize stores:', e)
  })

  const settingStore = useSettingStore()
  const initStore = useInitStore()
  const siteDefaultLocale = initStore.initialized
    ? settingStore.SystemSetting.default_locale
    : undefined
  const i18n = await setupI18n(siteDefaultLocale).catch((e) => {
    console.warn('Failed to setup i18n:', e)
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

  const loaderTimeout = new Promise<void>((resolve) => {
    window.setTimeout(resolve, 3000)
  })
  Promise.race([router.isReady().catch(() => undefined), loaderTimeout]).then(() => {
    startLoaderFade()
  })
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err)
  startLoaderFade()
})
