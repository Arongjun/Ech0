// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse, compileStyle } from 'vue/compiler-sfc'
import { createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import TheLoadingIndicator from '@/components/common/TheLoadingIndicator.vue'

vi.mock('@/stores/setting', () => ({ useSettingStore: () => ({ SystemSetting: {} }) }))

const html = readFileSync(resolve('index.html'), 'utf8')
const parsed = new DOMParser().parseFromString(html, 'text/html')
const startupCss = [...parsed.querySelectorAll('style')].map((s) => s.textContent).join('\n')
const glassCss = readFileSync(resolve('src/themes/arong-ios-glass-pro.css'), 'utf8')
const baseCss = readFileSync(resolve('src/themes/base.scss'), 'utf8')
const { descriptor } = parse(
  readFileSync(resolve('src/components/common/TheLoadingIndicator.vue'), 'utf8'),
)
const scoped = compileStyle({
  filename: 'TheLoadingIndicator.vue',
  source: descriptor.styles[0]!.content,
  id: (TheLoadingIndicator as unknown as { __scopeId: string }).__scopeId,
  scoped: true,
})
const styles: HTMLStyleElement[] = []
function addCss(css: string) {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  styles.push(style)
  return style.sheet!
}
afterEach(() => {
  styles.splice(0).forEach((style) => style.remove())
  document.body.innerHTML = ''
})

it.each([false, true])(
  'renders per-letter upstream motion through the glass cascade (reduced motion=%s)',
  (reduce) => {
    document.body.innerHTML = parsed.body.innerHTML
    const wrapper = mount(TheLoadingIndicator, {
      global: { plugins: [createPinia()] },
      props: { label: 'Loading article' },
      attachTo: document.body,
    })
    const sheets = [addCss(startupCss), addCss(baseCss), addCss(glassCss), addCss(scoped.code)]
    // jsdom does not evaluate OS media preferences. Activate only these real
    // reduced-motion rules explicitly; this checks CSS cascade, not visual frames.
    if (reduce) {
      const motionRules = sheets
        .flatMap((sheet) => [...sheet.cssRules])
        .filter(
          (rule) =>
            rule instanceof CSSMediaRule &&
            rule.conditionText === '(prefers-reduced-motion: reduce)',
        ) as CSSMediaRule[]
      motionRules.forEach((rule) =>
        addCss([...rule.cssRules].map((child) => child.cssText).join('\n')),
      )
    }
    const startup = document.querySelector('.loader-brand')!
    const glyphs = startup.querySelectorAll('span')
    expect(glyphs).toHaveLength(7)
    expect([...glyphs].map((glyph) => glyph.textContent).join('')).toBe('Loading')
    const inline = wrapper.get('.loading-wordmark > span').element
    for (const glyph of [glyphs[0]!, inline]) {
      const animation = getComputedStyle(glyph).animation
      if (reduce) expect(animation).toBe('none')
      else expect(animation).toMatch(/(?:loading-)?letter-hop/)
    }
    expect(getComputedStyle(wrapper.element).getPropertyValue('--hop-cycle').trim()).toBe('1.4s')
    const keyframes = sheets
      .flatMap((sheet) => [...sheet.cssRules])
      .filter((rule) => rule instanceof CSSKeyframesRule) as CSSKeyframesRule[]
    const transforms = (rule: CSSKeyframesRule) =>
      [...rule.cssRules].map((frame) => (frame as CSSKeyframeRule).style.transform)
    const bootFrames = transforms(keyframes.find((rule) => rule.name === 'letter-hop')!)
    expect(bootFrames).toEqual([
      'translateY(0px) scale(1) rotate(0deg)',
      'translateY(0.04em) scale(1.08, 0.92) rotate(0deg)',
      'translateY(-0.3em) scale(0.96, 1.05) rotate(var(--tilt, 0deg))',
      'translateY(0px) scale(1.06, 0.94) rotate(0deg)',
    ])
    expect(
      transforms(keyframes.find((rule) => rule.name.startsWith('loading-letter-hop'))!),
    ).toEqual(bootFrames)
    expect(document.querySelector('.loader-shell, .loader-widget-smile, #loader-logo')).toBeNull()
    wrapper.unmount()
  },
)
