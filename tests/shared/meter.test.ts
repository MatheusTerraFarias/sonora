import { expect, test } from 'vitest'
import {
  CLIP_HOLD_MS,
  NO_SIGNAL_AFTER_MS,
  SILENCE_DB,
  channelStatus,
  levelState,
  measure,
  stepTrack
} from '../../src/shared/meter'

/** Senoide com 8 ciclos em n amostras; pico exato em amplitude. */
function sine(amplitude: number, n = 4096): Float32Array {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = amplitude * Math.sin((2 * Math.PI * 8 * i) / n)
  return out
}

const SILENT = new Float32Array(1024)

test('silêncio absoluto vira SILENCE_DB', () => {
  const m = measure(new Float32Array(1024))
  expect(m.rmsDb).toBe(SILENCE_DB)
  expect(m.peakDb).toBe(SILENCE_DB)
  expect(m.clipped).toBe(false)
})

test('array vazio não produz NaN nem -Infinity', () => {
  const m = measure(new Float32Array(0))
  expect(m.rmsDb).toBe(SILENCE_DB)
  expect(m.peakDb).toBe(SILENCE_DB)
  expect(m.clipped).toBe(false)
})

test('senoide de amplitude 0,5 ≈ -9 dBFS rms', () => {
  expect(measure(sine(0.5)).rmsDb).toBeCloseTo(-9.03, 1)
})

test('amostra em 1,0 marca clip', () => {
  expect(measure(Float32Array.of(0, 1, 0)).clipped).toBe(true)
})

test('amostra negativa em -1,0 também marca clip', () => {
  expect(measure(Float32Array.of(0, -1, 0)).clipped).toBe(true)
})

test('pico usa o maior valor absoluto', () => {
  expect(measure(Float32Array.of(0.1, -0.5, 0.2)).peakDb).toBeCloseTo(20 * Math.log10(0.5), 3)
})

test('levelState classifica silencioso, ok e quente', () => {
  expect(levelState(SILENCE_DB)).toBe('silent')
  expect(levelState(-30)).toBe('ok')
  expect(levelState(-6)).toBe('hot')
  expect(levelState(-3)).toBe('hot')
})

test('clip de um quadro fica aceso por CLIP_HOLD_MS', () => {
  const t0 = stepTrack(null, measure(Float32Array.of(0, 1, 0)), 0)
  const t1 = stepTrack(t0, measure(SILENT), 1400)
  expect(channelStatus(t1, 1400)).toBe('clip')
  const t2 = stepTrack(t1, measure(SILENT), 1600)
  expect(channelStatus(t2, 1600)).toBe('signal')
  expect(CLIP_HOLD_MS).toBe(1500)
})

test('pico retém e depois decai 20 dB/s', () => {
  const peak = measure(Float32Array.of(10 ** (-3 / 20)))
  const t0 = stepTrack(null, peak, 0)
  const t900 = stepTrack(t0, measure(SILENT), 900)
  expect(t900.peakDb).toBeCloseTo(-3, 1)
  const t1500 = stepTrack(t900, measure(SILENT), 1500)
  expect(t1500.peakDb).toBeCloseTo(-13, 1)
})

test('sem sinal por mais de 10 s → no-signal', () => {
  expect(NO_SIGNAL_AFTER_MS).toBe(10000)
  const t0 = stepTrack(null, measure(SILENT), 0)
  expect(channelStatus(t0, 10001)).toBe('no-signal')
  expect(channelStatus(t0, 9999)).toBe('signal')
})

test('lastSignalAt só avança com sinal acima do piso', () => {
  const t0 = stepTrack(null, measure(sine(0.5)), 0)
  const t1 = stepTrack(t0, measure(SILENT), 5000)
  expect(t1.lastSignalAt).toBe(0)
  const t2 = stepTrack(t1, measure(sine(0.5)), 6000)
  expect(t2.lastSignalAt).toBe(6000)
})
