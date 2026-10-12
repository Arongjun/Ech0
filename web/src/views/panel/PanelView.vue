<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<script setup lang="ts">
import PanelPage from './modules/PanelPage.vue'
import { onMounted } from 'vue'
import { theToast } from '@/utils/toast'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

onMounted(() => {
  const url = new URL(window.location.href)
  const bind = url.searchParams.get('bind')
  const errorMsg = url.searchParams.get('error')
  if (bind === 'success') {
    theToast.success(String(t('oauth2Setting.bindSuccess')), { duration: 5000 })
    window.history.replaceState({}, '', url.pathname)
  } else if (bind === 'failed' || errorMsg) {
    theToast.error(errorMsg ? decodeURIComponent(errorMsg) : String(t('oauth2Setting.bindFailed')))
    window.history.replaceState({}, '', url.pathname)
  }
})
</script>

<template>
  <div class="w-full px-2">
    <PanelPage />
  </div>
</template>

<style></style>
