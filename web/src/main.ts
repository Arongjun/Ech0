// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import 'virtual:uno.css'
import '@/themes/index.scss'
import '@/themes/arong-ios-glass-pro.css'
import 'floating-vue/dist/style.css'

import { createApp, nextTick } from 'vue'
import { createPinia } from 'pinia'
import FloatingVue from 'floating-vue'

import App from './App.vue'
import router from './router'
import { initStores } from './stores/store-init'
import { preloadMarkdown } from './editor/core/loader'
import { useSettingStore } from './stores/setting'
import { setupI18n } from './locales'

import BaseDialog from '@/components/common/BaseDialog.vue'
import { createStartupLoader } from '@/lib/startupLoader'

if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

const startupLoader = createStartupLoader()

async function bootstrap() {
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)

  // Restore upstream's initialized-before-mount lifecycle. Auth, onboarding and
  // locale must be settled before the first visible route (no login/locale flash).
  await Promise.all([initStores(), preloadMarkdown()])
  const settingStore = useSettingStore()
  app.use(await setupI18n(settingStore.SystemSetting?.default_locale))

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

  let mounted = false
  let mountError: unknown
  app.config.errorHandler = (err, _instance, info) => {
    console.error('[Vue App Error]', err, info)
    if (!mounted) mountError = err
  }

  await router.isReady()
  app.mount('#app')
  await nextTick()
  if (mountError) throw mountError
  mounted = true
  startupLoader.finish()
}

bootstrap().catch((err) => {
  console.error('Failed to bootstrap application:', err)
  startupLoader.fail()
})
