// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TheLoadingIndicator from '@/components/common/TheLoadingIndicator.vue'

const settings = reactive({ server_name: '', site_title: '' })
vi.mock('@/stores/setting', () => ({ useSettingStore: () => ({ SystemSetting: settings }) }))
const wordmark = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAll('.loading-wordmark > span')
    .map((letter) => letter.text())
    .join('')
beforeEach(() => {
  setActivePinia(createPinia())
  settings.server_name = 'rong A'
  settings.site_title = 'www.wuenrong.com'
})
afterEach(() => setActivePinia(undefined))
it('inherits the short brand and updates reactively without restoring the official wordmark', async () => {
  const wrapper = mount(TheLoadingIndicator, {
    global: { plugins: [createPinia()] },
    props: { size: 'sm', label: '正在加载', center: false },
  })
  expect(wordmark(wrapper)).toBe('rongA')
  expect(wrapper.attributes('role')).toBe('status')
  expect(wrapper.attributes('aria-live')).toBe('polite')
  expect(wrapper.find('.loading-wordmark').attributes('aria-hidden')).toBe('true')
  expect(wrapper.find('.loading-label').text()).toBe('正在加载')
  expect(wrapper.classes()).toContain('loading-indicator--sm')
  expect(wrapper.classes()).not.toContain('loading-indicator--center')
  settings.server_name = '阿荣'
  await nextTick()
  expect(wordmark(wrapper)).toBe('阿荣')
  wrapper.unmount()
})
it('uses the custom site title if the short name is still default and bounds the inline size', () => {
  settings.server_name = 'Ech0'
  const wrapper = mount(TheLoadingIndicator, { global: { plugins: [createPinia()] } })
  expect(wordmark(wrapper)).toBe('www.wuenrong.com')
  expect(wrapper.attributes('style')).toContain('--wordmark-scale: 0.5')
  expect(wrapper.find('.sr-only').text()).toBe('Loading')
  wrapper.unmount()
})
it('has a neutral accessible fallback outside Pinia during errors or isolated mounting', () => {
  setActivePinia(undefined)
  const wrapper = mount(TheLoadingIndicator)
  expect(wordmark(wrapper)).toBe('Loading')
  expect(wrapper.text()).not.toContain('Ech0')
  wrapper.unmount()
})
