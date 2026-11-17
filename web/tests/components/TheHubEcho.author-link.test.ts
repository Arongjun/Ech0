// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { shallowMount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { beforeEach, expect, it, vi } from 'vitest'
import TheHubEcho from '@/components/advanced/echo/cards/TheHubEcho.vue'

const userStore = reactive({ isLogin: false })
vi.mock('@/stores', () => ({ useUserStore: () => userStore }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/composables/useTimeDisplay', () => ({
  useTimeDisplay: () => ({ toggleTimeDisplay: vi.fn(), formatDisplayTime: () => 'now' }),
}))
vi.mock('@/components/advanced/md', () => ({
  TheMdPreview: {
    name: 'TheMdPreview',
    props: ['content'],
    emits: ['open-detail'],
    template: '<div />',
  },
}))
const echo = {
  id: 'square-post',
  server_name: 'Author Site',
  server_url: 'https://author.example',
  logo: 'https://author.example/avatar.png',
  content: '[body link](https://body.example/read)',
  createdTs: 123,
  layout: 'grid',
  echo_files: [],
} as unknown as App.Api.Hub.Echo
const renderCard = (requireAuthorLogin = true) =>
  shallowMount(TheHubEcho, {
    props: { echo, requireAuthorLogin },
    global: {
      directives: { tooltip: () => {} },
      stubs: { TheMediaPlayer: true, TheExtensionRenderer: true },
    },
  })
beforeEach(() => {
  userStore.isLogin = false
  vi.restoreAllMocks()
})

it('renders anonymous square authors as plain noninteractive text with no website navigation target', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const wrapper = renderCard()
  const heading = wrapper.get('h2')
  expect(heading.text()).toBe('Author Site')
  expect(heading.find('a').exists()).toBe(false)
  const author = heading.get('span')
  expect(author.attributes('href')).toBeUndefined()
  expect(author.attributes('tabindex')).toBeUndefined()
  expect(author.attributes('role')).toBeUndefined()
  expect(author.element.closest('a,button,[role="link"],[tabindex]')).toBeNull()
  for (const event of ['click', 'contextmenu']) await author.trigger(event)
  await author.trigger('auxclick', { button: 1 })
  await author.trigger('keydown', { key: 'Enter' })
  await author.trigger('keydown', { key: ' ' })
  expect(open).not.toHaveBeenCalled()
  expect(wrapper.find('a[href="https://author.example"]').exists()).toBe(false)
  wrapper.unmount()
})
it('keeps authenticated author navigation to the correct website in a safe new tab', () => {
  userStore.isLogin = true
  const wrapper = renderCard()
  const author = wrapper.get('h2 a')
  expect(author.text()).toBe('Author Site')
  expect(author.attributes('href')).toBe(echo.server_url)
  expect(author.attributes('target')).toBe('_blank')
  expect(author.attributes('rel')).toBe('noopener noreferrer')
  wrapper.unmount()
})
it('reacts to login and logout on the same mounted square card', async () => {
  const wrapper = renderCard()
  expect(wrapper.find('h2 a').exists()).toBe(false)
  userStore.isLogin = true
  await nextTick()
  expect(wrapper.get('h2 a').attributes('href')).toBe(echo.server_url)
  userStore.isLogin = false
  await nextTick()
  expect(wrapper.find('h2 a').exists()).toBe(false)
  expect(wrapper.get('h2 span').text()).toBe('Author Site')
  wrapper.unmount()
})
it('does not gate peer author websites and updates when the world changes', async () => {
  const wrapper = renderCard(false)
  expect(wrapper.get('h2 a').attributes('href')).toBe(echo.server_url)
  await wrapper.setProps({ requireAuthorLogin: true })
  expect(wrapper.find('h2 a').exists()).toBe(false)
  await wrapper.setProps({ requireAuthorLogin: false })
  expect(wrapper.get('h2 a').attributes('href')).toBe(echo.server_url)
  wrapper.unmount()
})
it('leaves anonymous post detail links, body payload, media and reactions unchanged', async () => {
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const wrapper = renderCard()
  const detail = wrapper.get('a')
  expect(detail.attributes('href')).toBe('https://author.example/echo/square-post')
  expect(detail.attributes('rel')).toBe('noopener noreferrer')
  const markdown = wrapper.findComponent({ name: 'TheMdPreview' })
  expect(markdown.props('content')).toBe(echo.content)
  markdown.vm.$emit('open-detail')
  expect(open).toHaveBeenCalledWith(
    'https://author.example/echo/square-post',
    '_blank',
    'noopener,noreferrer',
  )
  expect(wrapper.findComponent({ name: 'TheEchoReactions' }).props('echo')).toEqual(echo)
  expect(wrapper.find('img').attributes('src')).toBe(echo.logo)
  wrapper.unmount()
})
