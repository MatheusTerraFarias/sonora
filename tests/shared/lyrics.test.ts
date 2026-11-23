import { expect, test } from 'vitest'
import { parseLyrics, serializeLyrics } from '../../src/shared/lyrics'

const SAMPLE = '[Estrofe 1]\nA\nB\n\nC\n\n[Refrão]\nR1\n\n[Estrofe 2]\nD\n\n[Refrão]'

test('marcadores, slides e repetição', () => {
  const r = parseLyrics(SAMPLE)
  expect(r.parts.map((p) => p.label)).toEqual(['Estrofe 1', 'Refrão', 'Estrofe 2'])
  expect(r.parts[0].slides).toEqual(['A\nB', 'C'])
  expect(r.arrangement).toEqual([0, 1, 2, 1])
})

test('normaliza texto colado', () => {
  const r = parseLyrics('refrão:\r\nX  \r\n\r\n\r\n\r\nY\r\n')
  expect(r.parts).toEqual([{ label: 'refrão', slides: ['X', 'Y'] }])
})

test('sem marcadores vira Parte N', () => {
  expect(parseLyrics('A\n\nB').parts.map((p) => p.label)).toEqual(['Parte 1', 'Parte 2'])
})

test('marcador repetido com conteúdo idêntico reutiliza a parte', () => {
  const r = parseLyrics('[Refrão]\nX\n\n[Verso 1]\nY\n\n[Refrão]\nX')
  expect(r.parts).toHaveLength(2)
  expect(r.arrangement).toEqual([0, 1, 0])
})

test('serialize → parse preserva partes e arranjo', () => {
  const first = parseLyrics(SAMPLE)
  const parts = first.parts.map((p, i) => ({ id: `p${i}`, ...p }))
  const text = serializeLyrics(parts, first.arrangement.map((i) => `p${i}`))
  expect(text).toBe('[Estrofe 1]\nA\nB\n\nC\n\n[Refrão]\nR1\n\n[Estrofe 2]\nD\n\n[Refrão]')
  expect(parseLyrics(text)).toEqual(first)
})

test('serialize → parse com partes sem marcador (Parte N)', () => {
  const first = parseLyrics('A\n\nB')
  const parts = first.parts.map((p, i) => ({ id: `p${i}`, ...p }))
  const text = serializeLyrics(parts, first.arrangement.map((i) => `p${i}`))
  expect(parseLyrics(text)).toEqual(first)
})
