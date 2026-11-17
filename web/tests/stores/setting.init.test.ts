// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'

const apiMocks = vi.hoisted(() => ({
  fetchGetSettings: vi.fn(),
  fetchGetS3Settings: vi.fn(),
  fetchGetOAuth2Settings: vi.fn(),
  fetchGetAllWebhooks: vi.fn(),
  fetchListAccessTokens: vi.fn(),
  fetchGetBackupScheduleSetting: vi.fn(),
  fetchGetAgentSettings: vi.fn(),
  fetchGetAgentInfo: vi.fn(),
  fetchHelloEch0: vi.fn(),
}))

vi.mock('@/service/api', () => apiMocks)

describe('settingStore.init', () => {
  afterEach(() => document.getElementById('ech0-site-branding')?.remove())
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    apiMocks.fetchGetSettings.mockResolvedValue({
      code: 1,
      data: {
        site_title: 'Ech0',
        server_logo: '/Ech0.svg',
        server_name: 'Ech0',
        server_url: '',
        allow_register: true,
        default_locale: 'zh-CN',
        ICP_number: '',
        footer_content: '',
        footer_link: '',
        home_welcome_text: '欢迎光临',
        home_signature_text: 'Powered by Ech0',
        home_signature_url: '',
        meting_api: '',
        custom_css: '',
        custom_js: '',
      },
    })
    apiMocks.fetchGetS3Settings.mockResolvedValue({ code: 1, data: { enable: false } })
    apiMocks.fetchGetAgentInfo.mockResolvedValue({
      code: 1,
      data: { enable: false, model: '', protocol: 'openai' },
    })
    apiMocks.fetchHelloEch0.mockResolvedValue({ code: 1, data: {} })
  })

  it('uses fresh SSR identity on a cold direct article load while metadata is slow, instead of stale cache or Ech0', async () => {
    const identity = document.createElement('script')
    identity.id = 'ech0-site-branding'
    identity.type = 'application/json'
    identity.textContent = JSON.stringify({
      site_title: 'Fresh Site',
      server_name: 'Fresh Author',
      server_logo: '/images/fresh.png',
    })
    document.head.appendChild(identity)
    localStorage.setItem(
      'ech0:cached_system_setting',
      JSON.stringify({ site_title: 'Stale Site', server_name: 'Ech0' }),
    )
    document.title = 'An article with | punctuation | Fresh Site'
    let finish!: (value: unknown) => void
    apiMocks.fetchGetSettings.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const store = useSettingStore()
    const pending = store.init()
    expect(store.SystemSetting.site_title).toBe('Fresh Site')
    expect(store.SystemSetting.server_name).toBe('Fresh Author')
    expect(store.SystemSetting.server_logo).toBe('/images/fresh.png')
    expect(document.title).toBe('An article with | punctuation | Fresh Site')
    finish({ code: 1, data: { ...store.SystemSetting, server_name: 'Updated Author' } })
    await pending
    expect(store.SystemSetting.server_name).toBe('Updated Author')
  })

  it('匿名初始化时不请求 S3 设置', async () => {
    const userStore = useUserStore()
    userStore.user = null

    const settingStore = useSettingStore()
    await settingStore.init()

    expect(apiMocks.fetchGetS3Settings).not.toHaveBeenCalled()
  })

  it('管理员初始化时请求 S3 设置', async () => {
    const userStore = useUserStore()
    userStore.user = {
      id: 'admin-1',
      username: 'admin',
      is_admin: true,
      locale: 'zh-CN',
    }

    const settingStore = useSettingStore()
    await settingStore.init()

    expect(apiMocks.fetchGetS3Settings).toHaveBeenCalledTimes(1)
  })
})
