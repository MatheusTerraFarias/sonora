import { expect, test } from 'vitest'
import { bibleSlides, type Passage } from '../../src/shared/slides'

const verses = (n: number, text: string): Passage['verses'] =>
  Array.from({ length: n }, (_, i) => ({ n: i + 1, text }))

test('versículos curtos são agrupados em um slide com título da referência', () => {
  const slides = bibleSlides({
    title: 'João 3:16-17',
    book: 'João',
    chapter: 3,
    verses: [
      { n: 16, text: 'A' },
      { n: 17, text: 'B' }
    ]
  })
  expect(slides).toHaveLength(1)
  expect(slides[0].title).toBe('João 3:16-17')
  expect(slides[0].text).toContain('16')
  expect(slides[0].text).toContain('B')
})

test('nenhum slide passa de maxChars', () => {
  const p: Passage = {
    title: 'Salmos 1:1-40',
    book: 'Salmos',
    chapter: 1,
    verses: verses(40, 'palavra '.repeat(15).trim())
  }
  const slides = bibleSlides(p, 400)
  expect(slides.length).toBeGreaterThan(1)
  for (const s of slides) expect(s.text.length).toBeLessThanOrEqual(400)
  expect(slides[0].title).toMatch(/^Salmos 1:1-\d+$/)
})

test('versículo maior que maxChars é quebrado em fronteira de palavra', () => {
  const long = Array.from({ length: 120 }, (_, i) => `palavra${i}`).join(' ')
  const slides = bibleSlides({ title: 'X 1:5', book: 'X', chapter: 1, verses: [{ n: 5, text: long }] }, 100)
  expect(slides.length).toBeGreaterThan(1)
  for (const s of slides) {
    expect(s.text.length).toBeLessThanOrEqual(100)
    expect(s.title).toBe('X 1:5')
  }
  const rejoined = slides
    .map((s) => s.text)
    .join(' ')
    .replace(/^5 /, '')
  expect(rejoined).toBe(long)
})

test('passagem vazia não gera slides', () => {
  expect(bibleSlides({ title: 'X', verses: [] })).toEqual([])
})

import { buildSlides } from '../../src/shared/slides'
import type { ResolvedItem, Song } from '../../src/shared/types'

const song = {
  id: 's1',
  title: 'T',
  parts: [
    { id: 'p1', label: 'E1', slides: ['a', 'b'] },
    { id: 'p2', label: 'R', slides: ['r'] },
    { id: 'p3', label: 'E2', slides: ['c'] }
  ],
  arrangement: ['p1', 'p2', 'p3', 'p2']
} as unknown as Song
const mk = (data: any, missing = false): ResolvedItem => ({
  item: { id: 'i', serviceId: 'x', position: 0, data },
  missing,
  title: 't'
})
const deps = { song: (id: string) => (id === 's1' ? song : null), passage: () => null }

test('buildSlides: música segue o arranjo e usa o rótulo da parte', () => {
  const s = buildSlides(mk({ kind: 'song', songId: 's1' }), deps)
  expect(s.map((x) => x.label)).toEqual(['E1', 'E1', 'R', 'E2', 'R'])
  expect(s.map((x) => x.text)).toEqual(['a', 'b', 'r', 'c', 'r'])
})
test('buildSlides: aviso gera 1 slide; mídia, youtube e ausente geram []', () => {
  expect(buildSlides(mk({ kind: 'notice', title: 'Aviso', body: 'corpo', backgroundMediaId: null }), deps)).toEqual([
    { label: 'Aviso', title: 'Aviso', text: 'corpo' }
  ])
  expect(buildSlides(mk({ kind: 'media', mediaId: 'm' }), deps)).toEqual([])
  expect(buildSlides(mk({ kind: 'youtube', videoId: 'v', title: '', thumbnail: '' }), deps)).toEqual([])
  expect(buildSlides(mk({ kind: 'song', songId: 's1' }, true), deps)).toEqual([])
})
test('buildSlides: bíblia usa passage', () => {
  const d = { ...deps, passage: () => ({ title: 'João 3:16', verses: [{ n: 16, text: 'x' }] }) }
  expect(buildSlides(mk({ kind: 'bible', ref: 'João 3:16', translation: 'T' }), d)).toHaveLength(1)
})
