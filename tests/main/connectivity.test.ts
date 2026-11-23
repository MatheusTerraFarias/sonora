import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { Connectivity, PROBE_INTERVAL_MS, PROBE_RETRY_MS } from '../../src/main/connectivity'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function setup(results: (boolean | Error)[]) {
  const changes: boolean[] = []
  const probe = vi.fn(async () => {
    const r = results.length > 1 ? results.shift()! : results[0]
    if (r instanceof Error) throw r
    return r
  })
  const c = new Connectivity({ probe, onChange: (o) => changes.push(o) })
  return { c, changes, probe }
}

test('começa online; navegador offline derruba na hora', async () => {
  const { c, changes } = setup([true])
  expect(c.online).toBe(true)
  c.setNavigatorOnline(false)
  expect(c.online).toBe(false)
  expect(changes).toEqual([false])
  await vi.advanceTimersByTimeAsync(0)
  expect(c.online).toBe(false)
})

test('Wi-Fi ligado sem internet: duas falhas seguidas do teste deixam offline', async () => {
  const { c, changes } = setup([false])
  c.start()
  await vi.advanceTimersByTimeAsync(0)
  expect(c.online).toBe(true)
  await vi.advanceTimersByTimeAsync(PROBE_RETRY_MS)
  expect(c.online).toBe(false)
  expect(changes).toEqual([false])
})

test('teste que lança conta como falha e não propaga', async () => {
  const { c } = setup([new Error('rede')])
  c.start()
  await vi.advanceTimersByTimeAsync(PROBE_RETRY_MS)
  expect(c.online).toBe(false)
})

test('volta a online no primeiro teste bem-sucedido', async () => {
  const { c, changes } = setup([false, false, true])
  c.start()
  await vi.advanceTimersByTimeAsync(PROBE_RETRY_MS)
  expect(c.online).toBe(false)
  await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS)
  expect(c.online).toBe(true)
  expect(changes).toEqual([false, true])
})

test('mudança do navegador dispara um teste imediato; stop para os testes', async () => {
  const { c, probe } = setup([true])
  c.start()
  await vi.advanceTimersByTimeAsync(0)
  expect(probe).toHaveBeenCalledTimes(1)
  c.setNavigatorOnline(true)
  await vi.advanceTimersByTimeAsync(0)
  expect(probe).toHaveBeenCalledTimes(2)
  c.stop()
  await vi.advanceTimersByTimeAsync(PROBE_INTERVAL_MS * 3)
  expect(probe).toHaveBeenCalledTimes(2)
})
