// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createStartupLoader } from '@/lib/startupLoader'

const source = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
let cleanup: () => void
beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  document.body.innerHTML = parsed.body.innerHTML
  document.documentElement.classList.add('app-loading')
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(0), 16),
  )
  cleanup = () => window.dispatchEvent(new Event('ech0:startup-ready'))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
  document.documentElement.classList.remove('app-loading')
})
function runGuard() {
  new Function(document.getElementById('startup-loader-guard')!.textContent!)()
}

describe('branded startup lifecycle', () => {
  it('adopts upstream letter-hop motion, dark/light and reduced-motion rules', () => {
    expect(document.querySelectorAll('.loader-brand > span')).toHaveLength(7)
    expect(document.querySelector('.loader-brand')!.getAttribute('aria-label')).toBe('Loading')
    expect(document.getElementById('loader-logo')).toBeNull()
    expect(source).toContain('prefers-reduced-motion: reduce')
    expect(source).toContain('color-scheme: dark')
    expect(source).not.toContain('smile-spin')
    expect(source).toMatch(/<noscript\s*>/)
  })
  it.each(['dark', '"dark"', 'light', 'sunny'])(
    'honors the actual saved theme format before Vue: %s',
    (saved) => {
      localStorage.setItem('themeMode', saved)
      const head = new DOMParser().parseFromString(source, 'text/html').head
      const themeScript = [...head.querySelectorAll('script')].find((script) =>
        script.textContent?.includes("localStorage.getItem('themeMode')"),
      )!
      new Function(themeScript.textContent!)()
      expect(document.documentElement.style.colorScheme).toBe(
        saved.includes('dark') ? 'dark' : 'light',
      )
    },
  )
  it('keeps server-rendered article titles instead of replacing them with a generic cache title', () => {
    document.title = 'A specific article | Arong'
    localStorage.setItem('ech0:cached_system_setting', JSON.stringify({ site_title: 'stale' }))
    const head = new DOMParser().parseFromString(source, 'text/html').head
    const cacheScript = [...head.querySelectorAll('script')].find((script) =>
      script.textContent?.includes("var item = localStorage.getItem('ech0:cached_system_setting')"),
    )!
    new Function(cacheScript.textContent!)()
    expect(document.title).toBe('A specific article | Arong')
  })
  it('uses cached custom branding as text, not executable HTML', () => {
    localStorage.setItem(
      'ech0:cached_system_setting',
      JSON.stringify({
        site_title: 'Arong <img onerror=alert(1)>',
        server_logo: '/images/custom.png',
      }),
    )
    runGuard()
    const brand = document.querySelector('.loader-brand')!
    expect(brand.textContent).toBe('Arong <img onerror=alert(1)>')
    expect(brand.querySelector('img')).toBeNull()
    expect(brand.querySelectorAll('span')).toHaveLength(Array.from(brand.textContent!).length)
    expect(document.querySelector('#loader-identity img')).toBeNull()
  })
  it('does not override fresh server branding with stale cache', () => {
    document.getElementById('loader-identity')!.dataset.serverBrand = 'true'
    localStorage.setItem('ech0:cached_system_setting', JSON.stringify({ site_title: 'stale' }))
    runGuard()
    expect(document.querySelector('.loader-brand')!.getAttribute('aria-label')).toBe('Loading')
  })
  it('offers a retry on module failure without removing the loader over an empty app', () => {
    runGuard()
    createStartupLoader().fail()
    expect(document.getElementById('app-loader')!.getAttribute('role')).toBe('alert')
    expect(document.getElementById('loader-retry')!.hasAttribute('hidden')).toBe(false)
    expect(document.documentElement.classList.contains('app-loading')).toBe(true)
  })
  it('shows recovery if async startup hangs before Vue loads', () => {
    runGuard()
    vi.advanceTimersByTime(15000)
    expect(document.getElementById('loader-status')!.textContent).toContain('Loading interrupted')
  })
  it('only hands off after paint; child transitions cannot remove the overlay', () => {
    runGuard()
    const startup = createStartupLoader()
    startup.finish()
    startup.finish()
    vi.advanceTimersByTime(32)
    const child = new Event('transitionend', { bubbles: true })
    Object.defineProperty(child, 'propertyName', { value: 'opacity' })
    document.querySelector('.loader-brand')!.dispatchEvent(child)
    expect(document.getElementById('app-loader')).not.toBeNull()
    const end = new Event('transitionend')
    Object.defineProperty(end, 'propertyName', { value: 'opacity' })
    document.getElementById('app-loader')!.dispatchEvent(end)
    expect(document.getElementById('app-loader')).toBeNull()
    expect(document.documentElement.classList.contains('app-loading')).toBe(false)
    vi.advanceTimersByTime(20000)
  })
  it('clears without transitionend, including reduced-motion browsers', () => {
    runGuard()
    createStartupLoader().finish()
    vi.advanceTimersByTime(632)
    expect(document.getElementById('app-loader')).toBeNull()
  })
})
