// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

export interface HubInstance {
  id: string
  url: string
}

export interface HubConfig {
  instances: HubInstance[]
}

export interface EchoTag {
  id: string
  name: string
  created_at?: number | string
  usage_count?: number
}

export interface EchoPost {
  id: string
  content: string
  username?: string
  created_at: number | string
  fav_count?: number
  tags?: EchoTag[]
  echo_files?: App.Api.Ech0.EchoFile[]
  layout?: string
  extension?: App.Api.Ech0.EchoExtension | null
  private?: boolean
  user_id?: string
}

export interface EchoQueryBody {
  page: number
  pageSize: number
  search: string
  tagIds: string[]
  sortBy: string
  sortOrder: string
}

export interface EchoQueryPage {
  total: number
  items: EchoPost[]
}

export interface ProbeFailure {
  instance: HubInstance
  reason: string
}

export interface ProbeResult {
  eligible: HubInstance[]
  probeFailures: ProbeFailure[]
}

export interface InstanceConnectSummary {
  urlKey: string
  id: string
  serverName: string
  username: string
  rawLogo: string
  todayEchos: number
}
