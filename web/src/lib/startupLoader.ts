// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

// The inline HTML guard owns the pre-module watchdog and retry UI. Only hand
// off once Vue and the initial route are ready; never reveal an empty failed app.
export function createStartupLoader() {
  const loader = document.getElementById('app-loader')
  let finished = false
  let fading = false
  let timer: number | undefined
  const clear = () => {
    if (finished) return
    finished = true
    window.clearTimeout(timer)
    loader?.removeEventListener('transitionend', onTransitionEnd)
    loader?.remove()
    document.documentElement.classList.remove('app-loading')
  }
  const onTransitionEnd = (event: TransitionEvent) => {
    // Child wordmark/logo transitions must not cut off the overlay handoff.
    if (event.target === loader && event.propertyName === 'opacity') clear()
  }
  return {
    finish() {
      if (fading || finished) return
      fading = true
      window.dispatchEvent(new Event('ech0:startup-ready'))
      if (!loader) return clear()
      // One frame for Vue's layout, one for paint before the overlay leaves.
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          loader.addEventListener('transitionend', onTransitionEnd)
          loader.classList.add('fade-out')
          timer = window.setTimeout(clear, 600) // also covers reduced motion / no transition event
        }),
      )
    },
    fail() {
      if (!fading && !finished) window.dispatchEvent(new Event('ech0:startup-failed'))
    },
  }
}
