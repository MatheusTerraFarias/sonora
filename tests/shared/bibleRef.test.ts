import { expect, test } from 'vitest'
import { BOOKS, parseReference, formatReference } from '../../src/shared/bibleRef'

test.each([
  ['Jo 3:16', { bookId: 'JHN', chapter: 3, verseStart: 16, verseEnd: 16 }],
  ['joao 3.16-18', { bookId: 'JHN', chapter: 3, verseStart: 16, verseEnd: 18 }],
  ['João 3', { bookId: 'JHN', chapter: 3, verseStart: null, verseEnd: null }],
  ['Salmos 23', { bookId: 'PSA', chapter: 23, verseStart: null, verseEnd: null }],
  ['1Co 13:4-7', { bookId: '1CO', chapter: 13, verseStart: 4, verseEnd: 7 }],
  ['1 Co 13', { bookId: '1CO', chapter: 13, verseStart: null, verseEnd: null }],
  ['  gênesis 1:1 ', { bookId: 'GEN', chapter: 1, verseStart: 1, verseEnd: 1 }],
  ['Job 1:1', { bookId: 'JOB', chapter: 1, verseStart: 1, verseEnd: 1 }],
  ['1 João 4:8', { bookId: '1JN', chapter: 4, verseStart: 8, verseEnd: 8 }]
])('parseReference(%s)', (input, expected) => expect(parseReference(input)).toEqual(expected))

test.each(['Xyz 99', '', 'Jo', 'Jo 3:', '3'])('referência inválida: %s', (s) =>
  expect(parseReference(s)).toBeNull()
)

test('66 livros com ids únicos', () => {
  expect(BOOKS).toHaveLength(66)
  expect(new Set(BOOKS.map((b) => b.id)).size).toBe(66)
})

test('formatReference', () => {
  expect(formatReference('JHN', 3, 16, 16)).toBe('João 3:16')
  expect(formatReference('JHN', 3, 16, 17)).toBe('João 3:16-17')
  expect(formatReference('PSA', 23, null, null)).toBe('Salmos 23')
})
