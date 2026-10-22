// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const apiMocks = vi.hoisted(() => ({
  fetchLogin: vi.fn(),
  fetchSignup: vi.fn(),
  fetchGetCurrentUser: vi.fn(),
  fetchExchangeCode: vi.fn(),
  fetchQueryEchos: vi.fn(),
  fetchGetTags: vi.fn(),
  fetchGetEchoById: vi.fn(),
  fetchCreateTag: vi.fn(),
}))

vi.mock('@/service/api', () => apiMocks)
vi.mock('@/router', () => ({ default: { push: vi.fn() } }))
vi.mock('@/utils/toast', () => ({ theToast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ setToken: vi.fn(), clearToken: vi.fn() }),
}))

import { useUserStore } from '@/stores/user'
import { useEchoStore } from '@/stores/echo'

describe('userStore login refreshes the feed', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    apiMocks.fetchGetCurrentUser.mockResolvedValue({ code: 1, data: { id: '1', username: 'a' } })
    apiMocks.fetchQueryEchos.mockResolvedValue({
      code: 1,
      data: { total: 1, items: [{ id: 9, content: 'hi' }] },
    })
  })

  it('passkey/OAuth token-pair login reloads echos instead of leaving an empty list', async () => {
    const userStore = useUserStore()
    const echoStore = useEchoStore()

    await userStore.loginWithTokenPair({ access_token: 't' } as App.Api.Auth.TokenPairResponse)
    await vi.waitFor(() => expect(echoStore.echoList.length).toBe(1))
    expect(apiMocks.fetchQueryEchos).toHaveBeenCalledTimes(1)
    expect(echoStore.total).toBe(1)
  })

  it('password login reloads echos', async () => {
    apiMocks.fetchLogin.mockResolvedValue({ code: 1, data: { access_token: 't' } })
    const userStore = useUserStore()
    const echoStore = useEchoStore()

    await userStore.login({ username: 'a', password: 'b' } as App.Api.Auth.LoginParams)
    await vi.waitFor(() => expect(echoStore.echoList.length).toBe(1))
  })
})
