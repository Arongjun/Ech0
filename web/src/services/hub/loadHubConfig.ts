// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import type { HubConfig, HubInstance } from './types'
import { timeoutSignal } from './fetchTimeout'

const STATIC_FALLBACK_INSTANCES: HubInstance[] = [
  { id: 'abloom-echo', url: 'https://memo.abloom.site' },
  { id: 'alayedong', url: 'https://ech0.alayedong.cn' },
  { id: 'bin', url: 'https://3868088.xyz' },
  { id: 'ciraos', url: 'https://ech0.ciraos.top' },
  { id: 'galaha', url: 'https://galaha.cn' },
  { id: 'jinvic', url: 'https://mblog.jinvic.top' },
  { id: 'l1nsn0w', url: 'https://memo.sn0w.fyi' },
  { id: 'ljx', url: 'https://mm.ljx.icu' },
  { id: 'moretti-815', url: 'https://m.081531.xyz' },
  { id: 'panda', url: 'https://ech0.pandageneral.dpdns.org' },
  { id: 'rookiezoe', url: 'https://rookiezoe.com' },
  { id: 'sean', url: 'https://echo.ssean.cn' },
  { id: 'sunboy-echo', url: 'https://echo.sunboy.ltd' },
  { id: 'suzic', url: 'https://ech0.suzichen.me' },
  { id: 'tiki-echo', url: 'https://i.zixizixi.cn' },
  { id: 'xiaoten', url: 'https://echo.xiaoten.com' },
  { id: 'zhangjwchn-blog', url: 'https://blog.zhangjw.cn' },
]

export function normalizeHubInstanceUrl(u: string): string {
  return u.trim().replace(/\/+$/, '')
}

function isNonEmptyString(s: unknown): s is string {
  return typeof s === 'string' && s.trim().length > 0
}

function parseInstancesFromJson(raw: unknown): HubInstance[] {
  if (
    typeof raw !== 'object' ||
    raw === null ||
    !('instances' in raw) ||
    !Array.isArray((raw as HubConfig).instances)
  ) {
    throw new Error('invalid shape (expected { instances: [...] })')
  }

  const out: HubInstance[] = []
  const seen = new Set<string>()
  for (const row of (raw as HubConfig).instances) {
    if (typeof row !== 'object' || row === null) continue
    const id = 'id' in row ? (row as { id: unknown }).id : undefined
    const url = 'url' in row ? (row as { url: unknown }).url : undefined
    if (!isNonEmptyString(id) || !isNonEmptyString(url)) continue
    try {
      const parsed = new URL(url.trim())
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
      const normalized = normalizeHubInstanceUrl(url.trim())
      if (seen.has(normalized)) continue
      seen.add(normalized)
      out.push({ id: id.trim(), url: normalized })
    } catch {
      continue
    }
  }
  return out
}

export async function loadHubConfig(signal?: AbortSignal): Promise<HubInstance[]> {
  // 1. Attempt official online hub.json with a snappy timeout
  try {
    const res = await fetch('https://hub.ech0.app/hub.json', {
      credentials: 'omit',
      signal: timeoutSignal(signal, 3000),
    })
    if (res.ok) {
      const json: unknown = await res.json()
      const parsed = parseInstancesFromJson(json)
      if (parsed.length > 0) return parsed
    }
  } catch {
    // Cross-origin, network, or timeout failure: fallback to local /hub.json
  }

  // 2. Attempt local same-origin /hub.json
  try {
    const res = await fetch('/hub.json', {
      signal: timeoutSignal(signal, 3000),
    })
    if (res.ok) {
      const json: unknown = await res.json()
      const parsed = parseInstancesFromJson(json)
      if (parsed.length > 0) return parsed
    }
  } catch {
    // Local /hub.json fetch error
  }

  // 3. Fallback to bundled static instances
  return STATIC_FALLBACK_INSTANCES
}
