import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { attachCrashRecovery, HANG_GRACE_MS, RELOAD_DELAY_MS } from '../../src/main/windows/crashRecovery'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function fakeContents() {
  const handlers = new Map<string, ((...a: any[]) => void)[]>()
  const wc = {
    destroyed: false,
    on(ev: string, cb: (...a: any[]) => void) {
      handlers.set(ev, [...(handlers.get(ev) ?? []), cb])
    },
    reload: vi.fn(),
    forcefullyCrashRenderer: vi.fn(),
    isDestroyed() {
      return this.destroyed
    },
    emit(ev: string, ...a: any[]) {
      for (const cb of handlers.get(ev) ?? []) cb(...a)
    }
  }
  return wc
}

test('processo do telão caiu: recarrega', () => {
  const wc = fakeContents()
  const onRecover = vi.fn()
  attachCrashRecovery(wc, onRecover)
  wc.emit('render-process-gone', {}, { reason: 'crashed' })
  expect(onRecover).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(RELOAD_DELAY_MS)
  expect(wc.reload).toHaveBeenCalledOnce()
})

test('saída limpa ou janela destruída não recarrega', () => {
  const wc = fakeContents()
  attachCrashRecovery(wc)
  wc.emit('render-process-gone', {}, { reason: 'clean-exit' })
  wc.destroyed = true
  wc.emit('render-process-gone', {}, { reason: 'crashed' })
  vi.advanceTimersByTime(RELOAD_DELAY_MS * 10)
  expect(wc.reload).not.toHaveBeenCalled()
})

test('travado além da tolerância: derruba o processo e recarrega uma vez só', () => {
  const wc = fakeContents()
  attachCrashRecovery(wc)
  wc.emit('unresponsive')
  vi.advanceTimersByTime(HANG_GRACE_MS)
  expect(wc.forcefullyCrashRenderer).toHaveBeenCalledOnce()
  // derrubar dispara render-process-gone: as duas recargas viram uma
  wc.emit('render-process-gone', {}, { reason: 'killed' })
  vi.advanceTimersByTime(RELOAD_DELAY_MS)
  expect(wc.reload).toHaveBeenCalledOnce()
})

test('voltou a responder dentro da tolerância: nada acontece', () => {
  const wc = fakeContents()
  attachCrashRecovery(wc)
  wc.emit('unresponsive')
  vi.advanceTimersByTime(HANG_GRACE_MS - 1)
  wc.emit('responsive')
  vi.advanceTimersByTime(HANG_GRACE_MS * 2)
  expect(wc.forcefullyCrashRenderer).not.toHaveBeenCalled()
  expect(wc.reload).not.toHaveBeenCalled()
})
