<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <section class="home-banner" aria-label="Intro">
    <div class="home-banner__top">
      <p class="home-banner__line">{{ homeWelcomeText }}</p>
    </div>
    <div class="home-banner__meta">
      <a
        v-if="homeSignatureUrl"
        :href="homeSignatureUrl"
        class="home-banner__powered"
        :aria-label="homeSignatureText"
      >
        {{ homeSignatureText }}
      </a>
      <span v-else class="home-banner__powered home-banner__powered--plain">
        {{ homeSignatureText }}
      </span>
      <a
        v-if="homeSignatureUrl"
        :href="homeSignatureUrl"
        class="home-banner__about"
        :aria-label="homeSignatureText"
        :title="homeSignatureText"
      >
        <Exclamation class="home-banner__about-icon" />
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores'
import Exclamation from '@/components/icons/exclamation.vue'

const { t } = useI18n()
const { SystemSetting } = storeToRefs(useSettingStore())

const homeWelcomeText = computed(
  () => SystemSetting.value.home_welcome_text?.trim() || t('homeBio.tagline'),
)
const homeSignatureText = computed(
  () => SystemSetting.value.home_signature_text?.trim() || 'Powered by Ech0',
)
const homeSignatureUrl = computed(() =>
  normalizeSignatureUrl(SystemSetting.value.home_signature_url),
)

const normalizeSignatureUrl = (url?: string) => {
  const rawUrl = url?.trim()
  if (!rawUrl) return ''
  if (/^(https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith('/') || rawUrl.startsWith('#')) {
    return rawUrl
  }
  return `https://${rawUrl}`
}
</script>

<style scoped>
.home-banner {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: 0.5rem;
  margin-bottom: 0.75rem;
  min-height: 6rem;
  padding: 0.75rem;
  border-radius: var(--radius-xs);
  background: var(--color-bg-surface);
  box-shadow: var(--shadow-soft);
}

.home-banner__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.home-banner__meta {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
}

@media (width <= 420px) {
  .home-banner {
    flex-wrap: wrap;
  }
}

.home-banner__line {
  margin: 0;
  font-family: 'Songti SC', STSong, var(--font-family-display);
  font-weight: 550;
  letter-spacing: 0.01em;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--color-text-secondary);
}

.home-banner__powered {
  margin: 0;
  font-family: var(--font-family-display);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-secondary);
  text-decoration: none;
}

a.home-banner__powered {
  cursor: pointer;
  transition: color 0.15s ease;
}

a.home-banner__powered:hover {
  color: var(--color-text-primary);
}

.home-banner__powered--plain {
  cursor: default;
}

.home-banner__about {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  color: var(--color-text-muted);
  text-decoration: none;
  outline: none;
  transition:
    color 0.15s ease,
    transform 0.15s ease;
}

.home-banner__about:hover {
  color: var(--color-accent);
  transform: translateY(-1px);
}

.home-banner__about:focus-visible {
  color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-soft);
}

.home-banner__about-icon {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 2.5rem;
}
</style>
