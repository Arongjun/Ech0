// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import type { EchoPost, EchoQueryBody, EchoQueryPage } from './types'
import { timeoutSignal } from './fetchTimeout'
import { timeValueToUnixSeconds } from '@/utils/timeValue'

const ECHO_QUERY_TIMEOUT_MS = 8000

function normalizeEchoPostTimes(item: EchoPost): EchoPost {
  return {
    ...item,
    created_at: timeValueToUnixSeconds(item.created_at),
    tags: item.tags?.map((t) => ({
      ...t,
      ...(t.created_at != null ? { created_at: timeValueToUnixSeconds(t.created_at) } : {}),
    })),
  }
}

const DEFAULT_QUERY: EchoQueryBody = {
  page: 1,
  pageSize: 10,
  search: '',
  tagIds: [],
  sortBy: '',
  sortOrder: 'desc',
}

export async function queryInstancePage(
  instanceUrl: string,
  body: Partial<EchoQueryBody> = {},
  signal?: AbortSignal,
): Promise<EchoPost[]> {
  const merged: EchoQueryBody = { ...DEFAULT_QUERY, ...body }

  // 1. First try /api/echo/query (standard Hub query endpoint)
  try {
    const res = await fetch(`${instanceUrl}/api/echo/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: merged.page,
        pageSize: merged.pageSize,
        search: merged.search,
        tagIds: merged.tagIds,
        sortBy: merged.sortBy,
        sortOrder: merged.sortOrder,
      }),
      credentials: 'omit',
      signal: timeoutSignal(signal, ECHO_QUERY_TIMEOUT_MS),
    })

    if (res.ok) {
      const json: unknown = await res.json()
      if (typeof json === 'object' && json !== null) {
        const r = json as { code: number; msg: string; data?: EchoQueryPage }
        if (r.code === 1 && r.data && Array.isArray(r.data.items)) {
          return r.data.items.map(normalizeEchoPostTimes)
        }
      }
    }
  } catch {
    // Try fallback
  }

  // 2. Fallback to /api/echo/page (compatible with older nodes)
  const resFallback = await fetch(`${instanceUrl}/api/echo/page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: merged.page,
      pageSize: merged.pageSize,
    }),
    credentials: 'omit',
    signal: timeoutSignal(signal, ECHO_QUERY_TIMEOUT_MS),
  })

  if (!resFallback.ok) {
    throw new Error(`HTTP ${resFallback.status}`)
  }

  const jsonFallback: unknown = await resFallback.json()
  if (typeof jsonFallback !== 'object' || jsonFallback === null) {
    throw new Error('invalid JSON')
  }

  const r = jsonFallback as { code: number; msg: string; data?: { items: EchoPost[] } }
  if (r.code !== 1 || !r.data || !Array.isArray(r.data.items)) {
    throw new Error(r.msg || 'query failed')
  }

  return r.data.items.map(normalizeEchoPostTimes)
}
