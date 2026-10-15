// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { createRouter, createWebHistory } from 'vue-router'
import { useInitStore } from '@/stores/init'
import { useUserStore } from '@/stores/user'
import { useEchoStore } from '@/stores/echo'
import { localStg, sessionStg } from '@/utils/storage'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (to.name === 'home' && (from.name === 'echo' || from.name === 'zen')) {
      if (savedPosition) {
        return savedPosition
      }
      try {
        const rawWindow = sessionStg.getItem('home:window:scrollTop')
        const windowTop = rawWindow ? Number(rawWindow) : 0
        if (Number.isFinite(windowTop) && windowTop > 0) {
          return { top: windowTop }
        }
      } catch {
        // ignore
      }
      return false
    }
    if (savedPosition) {
      return savedPosition
    }
    if (to.name === 'zen') {
      return false
    }
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/home/HomeView.vue'),
      meta: {
        title: 'Home',
        description: 'Ech0 home timeline for publishing and browsing thoughts, notes, and links.',
        optionalAuth: true,
      },
    },
    {
      path: '/publish',
      name: 'publish',
      redirect: { name: 'home', query: { tab: 'publish' } },
    },
    {
      path: '/panel',
      name: 'panel',
      component: () => import('../views/panel/PanelView.vue'),
      redirect: '/panel/dashboard',
      meta: {
        title: 'Panel',
        description: 'Ech0 management panel.',
        requiresAuth: true,
        noindex: true,
      },
      children: [
        {
          path: 'dashboard',
          name: 'panel-dashboard',
          component: () => import('../views/panel/modules/TheDashboard.vue'),
        },
        {
          path: 'setting',
          name: 'panel-setting',
          component: () => import('../views/panel/modules/TheSetting.vue'),
        },
        {
          path: 'user',
          name: 'panel-user',
          component: () => import('../views/panel/modules/TheUser.vue'),
        },
        {
          path: 'storage',
          name: 'panel-storage',
          component: () => import('../views/panel/modules/TheStorage.vue'),
        },
        {
          path: 'data-management',
          name: 'panel-data-management',
          component: () => import('../views/panel/modules/TheDataManagement.vue'),
        },
        {
          path: 'sso',
          name: 'panel-sso',
          component: () => import('../views/panel/modules/TheSSO.vue'),
        },
        {
          path: 'extension',
          name: 'panel-extension',
          component: () => import('../views/panel/modules/TheExtension.vue'),
        },
        {
          path: 'comment',
          name: 'panel-comment',
          component: () => import('../views/panel/modules/TheCommentManager.vue'),
        },
        {
          path: 'advance',
          name: 'panel-advance',
          component: () => import('../views/panel/modules/TheAdvance.vue'),
        },
        {
          path: 'system-log',
          name: 'panel-system-log',
          component: () => import('../views/panel/modules/TheSystemLog.vue'),
        },
      ],
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('../views/auth/AuthView.vue'),
      meta: {
        title: 'Sign In',
        description: 'Sign in to your Ech0 workspace.',
        noindex: true,
      },
    },
    {
      path: '/widget',
      name: 'widget',
      component: () => import('../views/widget/WidgetView.vue'),
      meta: {
        title: 'Widget',
        description: 'Ech0 embeddable widget.',
        noindex: true,
      },
    },
    {
      path: '/init',
      name: 'init',
      component: () => import('../views/init/InitView.vue'),
      meta: {
        title: 'Initialize',
        description: 'Initialize your Ech0 instance.',
        noindex: true,
      },
    },
    {
      path: '/hub',
      name: 'hub',
      component: () => import('../views/hub/HubView.vue'),
      meta: {
        title: 'Hub',
        description: 'Discover and explore curated content in Ech0 hub.',
      },
    },
    {
      path: '/chat',
      name: 'chat',
      component: () => import('../views/chat/ChatView.vue'),
      meta: {
        title: 'Chat',
        description: 'Reflect on and summarize your past echos with AI.',
        requiresAuth: true,
        noindex: true,
      },
    },
    {
      path: '/zen',
      name: 'zen',
      component: () => import('../views/zen/ZenView.vue'),
      meta: {
        title: 'Zen',
        description: 'Browse all echos in an immersive masonry view.',
        optionalAuth: true,
        noindex: true,
      },
    },
    {
      path: '/echo/:echoId',
      name: 'echo',
      component: () => import('../views/echo/EchoView.vue'),
      beforeEnter: (to) => {
        const echoId = String(to.params.echoId ?? '').trim()
        if (echoId) {
          useEchoStore().prefetchEcho(echoId)
        }
        return true
      },
      meta: {
        title: 'echoPage.title',
        description: 'Read a shared Ech0 post.',
      },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/404/NotFoundView.vue'),
      meta: {
        title: '404',
        description: 'Requested page was not found.',
        noindex: true,
      },
    },
  ],
})

const withTimeout = <T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

router.beforeEach(async (to) => {
  const initStore = useInitStore()
  const userStore = useUserStore()

  // Only redirect away from normal pages to /init if initStore has explicitly finished
  // checking and confirmed that the site is truly uninitialized with no owner.
  // Never block or redirect anonymous visitors just because network status is pending or failed.
  if (initStore.ready && !initStore.initialized && !initStore.ownerExists && to.name !== 'init') {
    return { name: 'init' }
  }

  // If already initialized, prevent accessing /init and route to home.
  const isInitDone =
    initStore.initialized ||
    initStore.ownerExists ||
    localStg.getItem<boolean>('initialized') === true

  if (isInitDone && to.name === 'init') {
    return { name: 'home' }
  }

  if (to.meta.requiresAuth) {
    if (!userStore.initialized) {
      await withTimeout(
        userStore.init().catch(() => undefined),
        2000,
        undefined,
      )
    }
    if (!userStore.isLogin) {
      return { name: 'auth' }
    }
  } else {
    if (!userStore.initialized) {
      userStore.init().catch(() => undefined)
    }
  }

  const needRedirect = localStg.getItem<boolean | string>('needLoginRedirect')

  if (
    to.meta.optionalAuth &&
    !userStore.isLogin &&
    (needRedirect === true || needRedirect === 'true')
  ) {
    localStg.removeItem('needLoginRedirect')
    return { name: 'auth' }
  }

  return true
})

router.onError((error) => {
  console.warn('[Router Error]', error)
  const isChunkError =
    error?.message &&
    (/Loading chunk/i.test(error.message) ||
      /Failed to fetch dynamically imported module/i.test(error.message) ||
      /error loading dynamically imported module/i.test(error.message))
  if (isChunkError && typeof window !== 'undefined') {
    const retryKey = 'ech0:chunk_reload_retry'
    if (!sessionStg.getItem(retryKey)) {
      sessionStg.setItem(retryKey, 'true')
      window.location.reload()
    }
  }
})

export default router
