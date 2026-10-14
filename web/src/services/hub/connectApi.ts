// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import type { HubInstance, InstanceConnectSummary } from './types'
import { timeoutSignal } from './fetchTimeout'
import { normalizeHubInstanceUrl } from './loadHubConfig'
import { HUB_FAN_OUT_LIMIT, pMapLimit } from './pMapLimit'

const CONNECT_TIMEOUT_MS = 6000

export function resolveHubInstanceLogo(rawUrl: string | undefined, instanceOrigin: string): string {
  const value = (rawUrl || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = normalizeHubInstanceUrl(instanceOrigin)
  if (value.startsWith('/')) return `${base}${value}`
  return `${base}/${value}`
}

export async function fetchInstanceConnect(
  instanceUrl: string,
  signal?: AbortSignal,
): Promise<App.Api.Connect.Connect | null> {
  const base = normalizeHubInstanceUrl(instanceUrl)
  try {
    const res = await fetch(`${base}/api/connect`, {
      credentials: 'omit',
      signal: timeoutSignal(signal, CONNECT_TIMEOUT_MS),
    })
    if (!res.ok) return null
    const json: unknown = await res.json()
    if (typeof json !== 'object' || json === null) return null
    const r = json as { code: number; msg: string; data?: App.Api.Connect.Connect }
    if (r.code !== 1 || !r.data) return null
    return r.data
  } catch {
    return null
  }
}

interface InstanceConnectFetched {
  urlKey: string
  rawLogo: string
  summary: InstanceConnectSummary
}

export async function fetchInstancesConnectBundle(
  instances: HubInstance[],
  signal?: AbortSignal,
): Promise<{ logos: Map<string, string>; summaries: InstanceConnectSummary[] }> {
  const settled = await pMapLimit<HubInstance, InstanceConnectFetched | null>(
    instances,
    HUB_FAN_OUT_LIMIT,
    async (inst) => {
      const urlKey = normalizeHubInstanceUrl(inst.url)
      const data = await fetchInstanceConnect(urlKey, signal)
      if (!data) return null
      const rawLogo = data.logo?.trim() ?? ''
      return {
        urlKey,
        rawLogo,
        summary: {
          urlKey,
          id: inst.id,
          serverName: data.server_name?.trim() || inst.id,
          username: data.sys_username?.trim() ?? '',
          rawLogo,
          todayEchos: typeof data.today_echos === 'number' ? data.today_echos : 0,
        },
      }
    },
  )

  const logos = new Map<string, string>()
  const summaries: InstanceConnectSummary[] = []
  for (const r of settled) {
    if (r.status !== 'fulfilled' || !r.value) continue
    const { urlKey, rawLogo, summary } = r.value
    if (rawLogo) logos.set(urlKey, rawLogo)
    summaries.push(summary)
  }

  summaries.sort((a, b) => a.serverName.localeCompare(b.serverName, 'en'))
  return { logos, summaries }
}
