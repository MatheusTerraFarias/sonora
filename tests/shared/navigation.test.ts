import { describe, expect, test } from 'vitest'
import { nextFromCursor, nextPosition, prevFromCursor, prevPosition } from '../../src/shared/navigation'

const items = [
  { slideCount: 2, skip: false },
  { slideCount: 0, skip: true },
  { slideCount: 1, skip: false }
]

test('next pula item ausente e passa ao próximo item', () => {
  expect(nextPosition(items, { item: 0, slide: 1 })).toEqual({ item: 2, slide: 0 })
})
test('next avança dentro do item', () => {
  expect(nextPosition(items, { item: 0, slide: 0 })).toEqual({ item: 0, slide: 1 })
})
test('next no último slide do culto retorna null', () => {
  expect(nextPosition(items, { item: 2, slide: 0 })).toBeNull()
})
test('next não passa por itens skip no fim', () => {
  expect(
    nextPosition(
      [
        { slideCount: 1, skip: false },
        { slideCount: 1, skip: true }
      ],
      { item: 0, slide: 0 }
    )
  ).toBeNull()
})
test('prev no slide 0 vai para o último slide do item anterior', () => {
  expect(prevPosition(items, { item: 2, slide: 0 })).toEqual({ item: 0, slide: 1 })
})
test('prev no início retorna null', () => {
  expect(prevPosition(items, { item: 0, slide: 0 })).toBeNull()
})
test('mídia (slideCount 0) conta como 1 posição', () => {
  const it = [
    { slideCount: 0, skip: false },
    { slideCount: 0, skip: false }
  ]
  expect(nextPosition(it, { item: 0, slide: 0 })).toEqual({ item: 1, slide: 0 })
  expect(prevPosition(it, { item: 1, slide: 0 })).toEqual({ item: 0, slide: 0 })
})

describe('a partir do cursor (com lacuna de item removido)', () => {
  const nav = [
    { slideCount: 2, skip: false },
    { slideCount: 0, skip: true },
    { slideCount: 3, skip: false },
    { slideCount: 1, skip: false }
  ]
  test('com item atual, igual a next/prevPosition', () => {
    expect(nextFromCursor(nav, 0, 1, null)).toEqual({ item: 2, slide: 0 })
    expect(prevFromCursor(nav, 2, 0, null)).toEqual({ item: 0, slide: 1 })
  })
  test('sem posição e sem lacuna: next vai ao primeiro válido, prev não faz nada', () => {
    expect(nextFromCursor(nav, -1, 0, null)).toEqual({ item: 0, slide: 0 })
    expect(prevFromCursor(nav, -1, 0, null)).toBeNull()
  })
  test('lacuna: next vai ao item que ocupa a posição (ou o seguinte válido)', () => {
    expect(nextFromCursor(nav, -1, 0, 2)).toEqual({ item: 2, slide: 0 })
    expect(nextFromCursor(nav, -1, 0, 1)).toEqual({ item: 2, slide: 0 })
    expect(nextFromCursor(nav, -1, 0, 4)).toBeNull()
  })
  test('lacuna: prev vai ao último slide do item anterior', () => {
    expect(prevFromCursor(nav, -1, 0, 3)).toEqual({ item: 2, slide: 2 })
    expect(prevFromCursor(nav, -1, 0, 2)).toEqual({ item: 0, slide: 1 })
    expect(prevFromCursor(nav, -1, 0, 0)).toBeNull()
    expect(prevFromCursor(nav, -1, 0, 9)).toEqual({ item: 3, slide: 0 })
  })
})
