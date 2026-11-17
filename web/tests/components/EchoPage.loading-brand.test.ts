// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { reactive, ref, nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import EchoPage from '@/views/echo/modules/EchoPage.vue'

const route = reactive({ path: '/echo/one', params: { echoId: 'one' } })
const settings = reactive({ site_title: '', server_name: 'Ech0' })
let resolvePost!: (value: unknown) => void
const prefetch = vi.fn(
  () =>
    new Promise((resolve) => {
      resolvePost = resolve
    }),
)
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key, locale: ref('zh-CN') }),
}))
vi.mock('@/stores', () => ({
  useEchoStore: () => ({ echoIndexMap: new Map(), echoList: [], prefetchEcho: prefetch }),
}))
vi.mock('@/stores/setting', () => ({ useSettingStore: () => ({ SystemSetting: settings }) }))
vi.mock('@/composables/useSeoHead', () => ({ DEFAULT_SEO_DESCRIPTION: 'description' }))
vi.mock('@/composables/useSeoOverride', () => ({
  clearSeoOverride: vi.fn(),
  setSeoOverride: vi.fn(),
}))
vi.mock('@/components/advanced/echo/cards/TheEchoDetail.vue', () => ({
  default: {
    name: 'TheEchoDetail',
    props: ['echo'],
    template: '<article>{{ echo.content }}</article>',
  },
}))
vi.mock('@/components/advanced/echo/cards/TheEchoInteractions.vue', () => ({
  default: { template: '<div />' },
}))
afterEach(() => {
  document.getElementById('ech0-site-branding')?.remove()
  prefetch.mockClear()
})

it('uses real instance branding on cold article fetch and subsequent navigation, not the default Ech0 name', async () => {
  const identity = document.createElement('script')
  identity.id = 'ech0-site-branding'
  identity.type = 'application/json'
  identity.textContent = JSON.stringify({ site_title: 'Own Site', server_name: 'Own Author' })
  document.head.appendChild(identity)
  const wrapper = mount(EchoPage, { global: { plugins: [createPinia()] } })
  const wordmark = () =>
    wrapper
      .findAll('.loading-wordmark > span')
      .map((span) => span.text())
      .join('')
  expect(wordmark()).toBe('OwnAuthor')
  expect(wrapper.text()).not.toContain('Ech0')
  resolvePost({ id: 'one', content: 'First article', echo_files: [], created_at: 1 })
  await nextTick()
  await nextTick()
  expect(wrapper.get('article').text()).toBe('First article')
  route.path = '/echo/two'
  route.params.echoId = 'two'
  await nextTick()
  expect(wordmark()).toBe('OwnAuthor')
  expect(wrapper.find('article').exists()).toBe(false)
  settings.server_name = 'New Author'
  await nextTick()
  expect(wordmark()).toBe('NewAuthor')
  resolvePost({ id: 'two', content: 'Second article', echo_files: [], created_at: 2 })
  await nextTick()
  await nextTick()
  expect(wrapper.get('article').text()).toBe('Second article')
  wrapper.unmount()
})
