// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { effectScope, nextTick, ref } from 'vue'
import { expect, it, vi } from 'vitest'
import { useSeoHead } from '@/composables/useSeoHead'
const { route } = vi.hoisted(() => ({
  route: { name: 'home', path: '/', fullPath: '/', meta: {} as Record<string, unknown> },
}))
vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({ locale: ref('zh-CN') }),
}))
it('refreshes settings-driven sharing metadata without navigation or a title change', async () => {
  document.head.innerHTML = '<script id="website-jsonld" type="application/ld+json"></script>'
  const settings = ref({
    site_title: 'Arong',
    server_name: 'rong',
    server_logo: '/images/old.png',
    home_signature_text: 'old description',
  })
  const scope = effectScope()
  scope.run(() => useSeoHead(settings))
  settings.value.server_logo = '/images/new.png'
  settings.value.home_signature_text = 'new description'
  settings.value.server_name = 'rong A'
  await nextTick()
  expect(document.querySelector('meta[property="og:image"]')!.getAttribute('content')).toContain(
    '/images/new.png',
  )
  expect(document.querySelector('meta[name="description"]')!.getAttribute('content')).toBe(
    'new description',
  )
  const ld = JSON.parse(document.getElementById('website-jsonld')!.textContent!)
  expect(ld.publisher.name).toBe('rong A')
  expect(ld.publisher['@type']).toBe('Person')
  expect(ld.sameAs).toBeUndefined()
  scope.stop()
})

it('noindexes unconfigured privacy and derives configured metadata from the real policy reactively', async () => {
  route.name = 'privacy'
  route.path = route.fullPath = '/privacy'
  route.meta = { title: 'Privacy Policy', description: 'Privacy policy for this website.' }
  document.head.innerHTML = '<script id="website-jsonld" type="application/ld+json"></script>'
  const settings = ref({ site_title: 'www.wuenrong.com', server_name: 'rong', privacy_policy: '' })
  const scope = effectScope()
  scope.run(() => useSeoHead(settings))
  expect(document.title).toBe('404 | www.wuenrong.com')
  expect(document.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe(
    'noindex,nofollow',
  )
  settings.value.privacy_policy = '# Privacy\n\nA **fixture** policy.'
  await nextTick()
  expect(document.title).toBe('Privacy Policy | www.wuenrong.com')
  expect(document.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe(
    'index,follow,max-image-preview:large',
  )
  expect(document.querySelector('meta[name="description"]')!.getAttribute('content')).toBe(
    'Privacy A fixture policy.',
  )
  settings.value.privacy_policy = '   '
  await nextTick()
  expect(document.title).toBe('404 | www.wuenrong.com')
  expect(document.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe(
    'noindex,nofollow',
  )
  scope.stop()
  route.name = 'home'
  route.path = route.fullPath = '/'
  route.meta = {}
})
