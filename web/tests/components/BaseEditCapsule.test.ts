// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 lin-snow

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BaseEditCapsule from '@/components/common/BaseEditCapsule.vue'

type CapsuleProps = {
  editing?: boolean
  saveShortcut?: boolean
}

const wrappers: VueWrapper[] = []

const mountCapsule = (props: CapsuleProps = {}) => {
  const wrapper = mount(BaseEditCapsule, {
    props: { editing: true, ...props },
    global: { directives: { tooltip: {} } },
  })
  wrappers.push(wrapper)
  return wrapper
}

const pressSave = (init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', {
    key: 's',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  window.dispatchEvent(event)
  return event
}

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

describe('BaseEditCapsule Ctrl+S', () => {
  it('emits apply and prevents the browser save dialog while editing', () => {
    const wrapper = mountCapsule()

    const event = pressSave()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('does nothing when not editing', () => {
    const wrapper = mountCapsule({ editing: false })

    const event = pressSave()

    expect(event.defaultPrevented).toBe(false)
    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('supports Cmd+S on macOS', () => {
    const wrapper = mountCapsule()

    pressSave({ ctrlKey: false, metaKey: true })

    expect(wrapper.emitted('apply')).toHaveLength(1)
  })

  it('ignores extra modifier keys', () => {
    const wrapper = mountCapsule()

    pressSave({ altKey: true })
    pressSave({ ctrlKey: true, shiftKey: true })

    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('ignores key repeat and IME composition', () => {
    const wrapper = mountCapsule()

    pressSave({ repeat: true })
    pressSave({ isComposing: true })

    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('can opt out with saveShortcut=false', () => {
    const wrapper = mountCapsule({ saveShortcut: false })

    pressSave()

    expect(wrapper.emitted('apply')).toBeUndefined()
  })

  it('throttles rapid repeated presses', () => {
    const wrapper = mountCapsule()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000)

    pressSave()
    pressSave()
    expect(wrapper.emitted('apply')).toHaveLength(1)

    now.mockReturnValue(1_000_600)
    pressSave()
    expect(wrapper.emitted('apply')).toHaveLength(2)
  })
})
