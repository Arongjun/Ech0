// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { theToast } from '@/utils/toast'
import { timeValueToMs } from '@/utils/timeValue'
import { useConnectStore } from './connect'
import { i18n } from '@/locales'
import { localStg } from '@/utils/storage'
import type { HubInstance, InstanceConnectSummary, EchoPost } from '@/services/hub/types'
import { loadHubConfig, normalizeHubInstanceUrl } from '@/services/hub/loadHubConfig'
import { probeInstances } from '@/services/hub/probeInstances'
import { fetchInstancesConnectBundle, resolveHubInstanceLogo } from '@/services/hub/connectApi'
import { queryInstancePage } from '@/services/hub/echoApi'
import { HUB_FAN_OUT_LIMIT, pMapLimit } from '@/services/hub/pMapLimit'

export type ExploreWorldMode = 'global' | 'peer'

const EXPLORE_WORLD_KEY = 'ech0_explore_world_mode'
const PAGE_SIZE = 10
const BATCH_SIZE = 10

interface HubBufferState {
  url: string
  instanceId: string
  serverName: string
  logo: string
  buffer: App.Api.Hub.Echo[]
  currentPage: number
  hasMore: boolean
  isLoading: boolean
}

function readStoredWorldMode(): ExploreWorldMode {
  const v = localStg.getItem<string>(EXPLORE_WORLD_KEY)
  return v === 'peer' ? 'peer' : 'global'
}

function toHubEcho(
  post: EchoPost,
  inst: { url: string; instanceId: string; serverName: string; logo: string },
): App.Api.Hub.Echo {
  const instKey = normalizeHubInstanceUrl(inst.url)
  return {
    id: post.id,
    content: post.content,
    username: post.username ?? '',
    echo_files: post.echo_files,
    tags: post.tags as App.Api.Hub.Echo['tags'],
    layout: post.layout,
    private: post.private ?? false,
    user_id: post.user_id ?? '',
    extension: post.extension,
    fav_count: post.fav_count ?? 0,
    created_at: post.created_at,
    createdTs: timeValueToMs(post.created_at),
    server_name: inst.serverName,
    server_url: instKey,
    virtual_key: `${instKey}-${post.id}`,
    logo: inst.logo,
  }
}

export const useHubStore = defineStore('hubStore', () => {
  const connectStore = useConnectStore()

  const worldMode = ref<ExploreWorldMode>(readStoredWorldMode())
  const activeNodes = ref<InstanceConnectSummary[]>([])
  const totalNodesCount = ref<number>(0)

  const hubStates = ref<Map<string, HubBufferState>>(new Map())
  const echoList = ref<App.Api.Hub.Echo[]>([])
  const existingIds = ref<Set<string>>(new Set())

  const isPreparing = ref<boolean>(true)
  const isLoading = ref<boolean>(false)
  const hasTriedInitialLoad = ref<boolean>(false)
  const hasMore = ref<boolean>(true)

  const activeNodesCount = computed(() => activeNodes.value.length)

  const reset = () => {
    hubStates.value.clear()
    echoList.value = []
    existingIds.value.clear()
    activeNodes.value = []
    totalNodesCount.value = 0
    isPreparing.value = true
    isLoading.value = false
    hasTriedInitialLoad.value = false
    hasMore.value = true
  }

  const fetchHubPage = async (hubUrl: string, signal?: AbortSignal): Promise<void> => {
    const state = hubStates.value.get(hubUrl)
    if (!state || state.isLoading || !state.hasMore) return

    state.isLoading = true
    try {
      const items = await queryInstancePage(
        hubUrl,
        {
          page: state.currentPage,
          pageSize: PAGE_SIZE,
          search: '',
          tagIds: [],
          sortBy: '',
          sortOrder: 'desc',
        },
        signal,
      )

      const mapped = items.map((echo) =>
        toHubEcho(echo, {
          url: state.url,
          instanceId: state.instanceId,
          serverName: state.serverName,
          logo: state.logo,
        }),
      )

      mapped.sort((a, b) => b.createdTs - a.createdTs)
      state.buffer.push(...mapped)
      state.currentPage++
      state.hasMore = items.length >= PAGE_SIZE
    } catch (err) {
      console.warn(`[Hub] fetch failed for ${hubUrl}:`, err)
      state.hasMore = false
    } finally {
      state.isLoading = false
    }
  }

  const initGlobalWorld = async (signal?: AbortSignal) => {
    let rawInstances: HubInstance[] = []
    try {
      rawInstances = await loadHubConfig(signal)
    } catch (e) {
      console.error('[Hub] loadHubConfig failed:', e)
    }
    totalNodesCount.value = rawInstances.length

    if (rawInstances.length === 0) {
      isPreparing.value = false
      hasTriedInitialLoad.value = true
      hasMore.value = false
      return
    }

    // 1. Probe healthz and version
    const probed = await probeInstances(rawInstances, signal)
    const eligible = probed.eligible

    if (eligible.length === 0) {
      theToast.info(String(i18n.global.t('hub.noAvailableInstance')))
      isPreparing.value = false
      hasTriedInitialLoad.value = true
      hasMore.value = false
      return
    }

    // 2. Fetch connect bundle for logos and names
    const bundle = await fetchInstancesConnectBundle(eligible, signal)
    activeNodes.value = bundle.summaries
    console.info(String(i18n.global.t('hub.connectedCount', { count: eligible.length })))

    // 3. Initialize buffers
    hubStates.value.clear()
    for (const inst of eligible) {
      const urlKey = normalizeHubInstanceUrl(inst.url)
      const rawLogo = bundle.logos.get(urlKey) ?? ''
      const logo = resolveHubInstanceLogo(rawLogo, urlKey) || '/Ech0.svg'
      const summary = bundle.summaries.find((s) => s.urlKey === urlKey)
      const serverName = summary?.serverName || inst.id

      hubStates.value.set(urlKey, {
        url: urlKey,
        instanceId: inst.id,
        serverName,
        logo,
        buffer: [],
        currentPage: 1,
        hasMore: true,
        isLoading: false,
      })
    }

    // 4. Parallel initial page fetch
    await pMapLimit(Array.from(hubStates.value.keys()), HUB_FAN_OUT_LIMIT, (url) =>
      fetchHubPage(url, signal),
    )

    isPreparing.value = false
    await loadEchoListPage(signal)
  }

  const initPeerWorld = async (signal?: AbortSignal) => {
    await connectStore.getConnect()
    const peers = connectStore.connects || []
    totalNodesCount.value = peers.length

    if (peers.length === 0) {
      theToast.info(String(i18n.global.t('hub.emptyList')))
      isPreparing.value = false
      hasTriedInitialLoad.value = true
      hasMore.value = false
      return
    }

    const peerInstances: HubInstance[] = peers.map((p, idx) => {
      const url = typeof p === 'string' ? p : p.connect_url
      const id = typeof p === 'string' ? `peer-${idx}` : p.id || `peer-${idx}`
      return { id, url: normalizeHubInstanceUrl(url) }
    })

    const bundle = await fetchInstancesConnectBundle(peerInstances, signal)
    activeNodes.value = bundle.summaries

    hubStates.value.clear()
    for (const inst of peerInstances) {
      const urlKey = normalizeHubInstanceUrl(inst.url)
      const rawLogo = bundle.logos.get(urlKey) ?? ''
      const logo = resolveHubInstanceLogo(rawLogo, urlKey) || '/Ech0.svg'
      const summary = bundle.summaries.find((s) => s.urlKey === urlKey)
      const serverName = summary?.serverName || inst.id

      hubStates.value.set(urlKey, {
        url: urlKey,
        instanceId: inst.id,
        serverName,
        logo,
        buffer: [],
        currentPage: 1,
        hasMore: true,
        isLoading: false,
      })
    }

    await pMapLimit(Array.from(hubStates.value.keys()), HUB_FAN_OUT_LIMIT, (url) =>
      fetchHubPage(url, signal),
    )

    isPreparing.value = false
    await loadEchoListPage(signal)
  }

  const initHubFeed = async (mode?: ExploreWorldMode, forceReload = false) => {
    if (mode) {
      worldMode.value = mode
      localStg.setItem(EXPLORE_WORLD_KEY, mode)
    }

    if (!forceReload && echoList.value.length > 0) {
      return
    }

    reset()
    if (worldMode.value === 'peer') {
      await initPeerWorld()
    } else {
      await initGlobalWorld()
    }
  }

  const setWorldMode = async (mode: ExploreWorldMode) => {
    if (worldMode.value === mode) return
    worldMode.value = mode
    localStg.setItem(EXPLORE_WORLD_KEY, mode)
    await initHubFeed(mode, true)
  }

  const flipWorld = async () => {
    const nextMode: ExploreWorldMode = worldMode.value === 'global' ? 'peer' : 'global'
    await setWorldMode(nextMode)
  }

  const loadEchoListPage = async (signal?: AbortSignal): Promise<void> => {
    if (isLoading.value || isPreparing.value) return

    const canLoadMore = Array.from(hubStates.value.values()).some(
      (s) => s.hasMore || s.buffer.length > 0,
    )
    if (!canLoadMore) {
      hasMore.value = false
      hasTriedInitialLoad.value = true
      return
    }

    isLoading.value = true
    try {
      const result: App.Api.Hub.Echo[] = []
      let attempts = 0
      const maxAttempts = BATCH_SIZE * 3

      while (result.length < BATCH_SIZE && attempts < maxAttempts) {
        attempts++

        let maxTs = -1
        let maxHubUrl: string | null = null

        for (const [url, state] of hubStates.value) {
          const head = state.buffer[0]
          if (head) {
            const headTs = head.createdTs
            if (headTs > maxTs) {
              maxTs = headTs
              maxHubUrl = url
            }
          }
        }

        if (maxHubUrl === null) {
          const emptyHubsWithMore = Array.from(hubStates.value.values()).filter(
            (s) => s.hasMore && !s.isLoading && s.buffer.length === 0,
          )

          if (emptyHubsWithMore.length === 0) {
            break
          }

          await pMapLimit(emptyHubsWithMore, HUB_FAN_OUT_LIMIT, (s) => fetchHubPage(s.url, signal))
          continue
        }

        const state = hubStates.value.get(maxHubUrl)!
        const echo = state.buffer.shift()!

        const key = `${echo.server_url}-${echo.id}`
        if (!existingIds.value.has(key)) {
          existingIds.value.add(key)
          result.push(echo)
        }

        if (state.buffer.length < 3 && state.hasMore && !state.isLoading) {
          void fetchHubPage(maxHubUrl, signal)
        }
      }

      echoList.value.push(...result)

      hasMore.value = Array.from(hubStates.value.values()).some(
        (s) => s.hasMore || s.buffer.length > 0,
      )

      if (!hasMore.value && echoList.value.length > 0) {
        theToast.info(String(i18n.global.t('hub.noMoreData')))
      }
    } finally {
      isLoading.value = false
      hasTriedInitialLoad.value = true
    }
  }

  // Backwards compatibility helpers
  const getHubList = async () => initHubFeed()
  const getHubInfoList = async () => {}

  return {
    worldMode,
    activeNodes,
    activeNodesCount,
    totalNodesCount,
    echoList,
    isLoading,
    isPreparing,
    hasTriedInitialLoad,
    hasMore,
    reset,
    initHubFeed,
    setWorldMode,
    flipWorld,
    loadEchoListPage,
    getHubList,
    getHubInfoList,
  }
})
