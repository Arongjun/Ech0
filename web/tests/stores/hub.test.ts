// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useHubStore } from '@/stores/hub'
import { meetsHubMinVersion, isVersionAtLeast } from '@/services/hub/healthz'
import { resolveHubInstanceLogo } from '@/services/hub/connectApi'
import { loadHubConfig, normalizeHubInstanceUrl } from '@/services/hub/loadHubConfig'
import { localStg } from '@/utils/storage'

vi.mock('@/stores/connect', () => ({
  useConnectStore: () => ({
    connects: [],
    getConnect: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/services/hub/probeInstances', () => ({
  probeInstances: vi.fn().mockResolvedValue({ eligible: [], probeFailures: [] }),
}))

vi.mock('@/services/hub/connectApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/hub/connectApi')>()
  return {
    ...actual,
    fetchInstancesConnectBundle: vi.fn().mockResolvedValue({ logos: new Map(), summaries: [] }),
  }
})

describe('Hub services & store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStg.removeItem('ech0_explore_world_mode')
  })

  it('correctly parses minimum supported versions', () => {
    expect(meetsHubMinVersion('4.4.0')).toBe(true)
    expect(meetsHubMinVersion('4.4.1')).toBe(true)
    expect(meetsHubMinVersion('5.2.0')).toBe(true)
    expect(meetsHubMinVersion('4.3.9')).toBe(false)
    expect(isVersionAtLeast('5.0.0', '4.4.0')).toBe(true)
    expect(isVersionAtLeast('4.4.0', '5.0.0')).toBe(false)
  })

  it('resolves instance logos properly for relative and absolute paths', () => {
    expect(resolveHubInstanceLogo('/logo.png', 'https://echo.example.com/')).toBe(
      'https://echo.example.com/logo.png',
    )
    expect(resolveHubInstanceLogo('https://cdn.example.com/logo.png', 'https://echo.example.com')).toBe(
      'https://cdn.example.com/logo.png',
    )
    expect(resolveHubInstanceLogo('', 'https://echo.example.com')).toBe('')
  })

  it('normalizes hub instance URLs', () => {
    expect(normalizeHubInstanceUrl(' https://example.com/ ')).toBe('https://example.com')
    expect(normalizeHubInstanceUrl('https://example.com///')).toBe('https://example.com')
  })

  it('loads fallback hub instances when network is unavailable', async () => {
    const instances = await loadHubConfig()
    expect(instances.length).toBeGreaterThan(0)
    expect(instances.some((inst) => inst.id === 'abloom-echo')).toBe(true)
  })

  it('toggles explore world mode and flips correctly', async () => {
    const hubStore = useHubStore()
    expect(hubStore.worldMode).toBe('global')

    await hubStore.flipWorld()
    expect(hubStore.worldMode).toBe('peer')
    expect(localStg.getItem('ech0_explore_world_mode')).toBe('peer')

    await hubStore.flipWorld()
    expect(hubStore.worldMode).toBe('global')
    expect(localStg.getItem('ech0_explore_world_mode')).toBe('global')
  })
})
