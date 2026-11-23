import { describe, expect, it } from 'vitest'
import { appendToArrangement, moveInArrangement, parseTags, removeFromArrangement } from '../../src/shared/arrangement'

describe('arrangement helpers', () => {
  it('move um chip sem mutar o original', () => {
    const a = ['a', 'b', 'c', 'b']
    expect(moveInArrangement(a, 0, 2)).toEqual(['b', 'c', 'a', 'b'])
    expect(moveInArrangement(a, 3, 0)).toEqual(['b', 'a', 'b', 'c'])
    expect(a).toEqual(['a', 'b', 'c', 'b'])
  })
  it('ignora índices inválidos', () => {
    expect(moveInArrangement(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(moveInArrangement(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })
  it('remove só o chip do índice (partes repetidas)', () => {
    expect(removeFromArrangement(['a', 'b', 'a'], 2)).toEqual(['a', 'b'])
  })
  it('adiciona ao final', () => {
    expect(appendToArrangement(['a'], 'a')).toEqual(['a', 'a'])
  })
  it('parseTags', () => {
    expect(parseTags(' louvor, Adoração ,, louvor ')).toEqual(['louvor', 'Adoração'])
    expect(parseTags('')).toEqual([])
  })
})
