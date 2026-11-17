import { afterEach, describe, expect, it, vi } from 'vitest'
import { queryInstancePage } from '@/services/hub/echoApi'

afterEach(() => vi.unstubAllGlobals())
describe('custom Hub compatibility with current upstream', () => {
  it('omits blank sorting and visitor/auth headers for cross-origin instance queries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ code: 1, data: { items: [] } }) })
    vi.stubGlobal('fetch', fetchMock)
    await queryInstancePage('https://peer.example', { sortBy: '' })
    const [, init] = fetchMock.mock.calls[0]!
    expect(JSON.parse(init.body)).not.toHaveProperty('sortBy')
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.credentials).toBe('omit')
  })
})
