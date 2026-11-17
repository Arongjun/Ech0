import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { HOME_TIMELINE_ANCHOR_KEY } from '@/utils/timeline'
import EchoTimelineList from '@/views/home/modules/EchoTimelineList.vue'

vi.mock('vue-router', () => ({ onBeforeRouteLeave: vi.fn() }))
vi.mock('@/components/advanced/echo/cards/TheEchoCard.vue', () => ({
  default: defineComponent({ render: () => h('article') }),
}))

afterEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})
describe('cached custom home timeline', () => {
  it('restores its row anchor after KeepAlive activation without observing other pages', async () => {
    const target = document.createElement('div')
    Object.defineProperty(target, 'clientHeight', { value: 600 })
    Object.defineProperty(target, 'scrollHeight', { value: 3000 })
    target.scrollTop = 300
    target.getBoundingClientRect = () => ({ top: 0 }) as DOMRect
    const scrollTo = vi.fn()
    target.scrollTo = scrollTo
    const visible = ref(true)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(KeepAlive, null, {
            default: () =>
              visible.value
                ? h(EchoTimelineList, {
                    items: [{ id: 'e1' }] as App.Api.Ech0.Echo[],
                    scrollTarget: target,
                    useWindow: false,
                    signature: 'custom-query',
                  })
                : null,
          }),
      }),
    )
    await nextTick()
    const row = wrapper.find('[data-echo-id]').element as HTMLElement
    row.getBoundingClientRect = () => ({ top: 100 - target.scrollTop }) as DOMRect
    Object.defineProperty(row, 'offsetHeight', { value: 1000 })
    target.dispatchEvent(new Event('scroll'))
    // pagehide flushes the same anchor as the route-leave guard before leaving.
    window.dispatchEvent(new Event('pagehide'))
    expect(JSON.parse(sessionStorage.getItem(HOME_TIMELINE_ANCHOR_KEY)!)).toMatchObject({
      id: 'e1',
      offset: 200,
    })
    visible.value = false
    await nextTick()
    target.scrollTop = 0
    window.dispatchEvent(new Event('pagehide'))
    visible.value = true
    await nextTick()
    await nextTick()
    expect(scrollTo).toHaveBeenCalledWith({ top: 300 })
    wrapper.unmount()
  })
})
