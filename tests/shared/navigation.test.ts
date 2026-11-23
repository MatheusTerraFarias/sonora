import { expect, test } from 'vitest'
import { nextPosition, prevPosition } from '../../src/shared/navigation'

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
