// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { shallowMount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import zh from '@/locales/messages/zh-CN.json'
import TheEchoMeta from '@/components/advanced/echo/cards/TheEchoMeta.vue'
vi.mock('@/stores', () => ({ useEchoStore: () => ({ tagList: [] }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useTimeDisplay', () => ({
  useTimeDisplay: () => ({ toggleTimeDisplay: vi.fn(), formatDisplayTime: () => 'now' }),
}))
it.each([0, 7])('shows historical aggregate %i separately from interactive reactions', (count) => {
  const wrapper = shallowMount(TheEchoMeta, {
    props: {
      echo: {
        id: 'test',
        content: 'hello',
        created_at: 100,
        legacy_like_count: count,
        reactions: [{ key: 'like', count: 2, reacted: false }],
      } as App.Api.Ech0.Echo,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })],
      directives: { tooltip: () => {} },
    },
  })
  expect(wrapper.text().includes('历史点赞')).toBe(count > 0)
  if (count) {
    expect(wrapper.text()).toContain('历史点赞 7')
    expect(wrapper.find('[title]').attributes('title')).toContain('与新的表情反应分别保留')
  }
  expect(wrapper.findComponent({ name: 'TheEchoReactions' }).props('echo').reactions[0].count).toBe(
    2,
  )
  wrapper.unmount()
})
