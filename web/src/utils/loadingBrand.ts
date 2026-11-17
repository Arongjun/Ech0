// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

export type LoadingIdentity = {
  site_title?: string
  server_name?: string
  server_logo?: string
}

export const customBrandName = (value: unknown): string => {
  const name = typeof value === 'string' ? value.trim() : ''
  return /^(?:ech0|echo)(?: team)?$/i.test(name) ? '' : name
}

// Public identity only, rendered into every server HTML route. Do not infer an
// instance name from an article title or wait for the settings API to paint it.
export const readServerLoadingIdentity = (): LoadingIdentity => {
  if (typeof document === 'undefined') return {}
  try {
    const value = JSON.parse(document.getElementById('ech0-site-branding')?.textContent || '{}')
    if (!value || typeof value !== 'object') return {}
    return {
      site_title: customBrandName(value.site_title),
      server_name: customBrandName(value.server_name),
      server_logo: typeof value.server_logo === 'string' ? value.server_logo : '',
    }
  } catch {
    return {}
  }
}

export const loadingBrandName = (setting?: LoadingIdentity): string => {
  const server = readServerLoadingIdentity()
  return (
    [setting?.server_name, setting?.site_title, server.server_name, server.site_title]
      .map(customBrandName)
      .find(Boolean) || 'Loading'
  )
}
