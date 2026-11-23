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
