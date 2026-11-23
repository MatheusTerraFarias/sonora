import { expect, test } from 'vitest'
import { pickProjectionDisplay } from '../../src/shared/displays'

const d = (id: number, primary = false): { id: number; primary: boolean } => ({ id, primary })

test('só um monitor (o do operador) retorna null', () => {
  expect(pickProjectionDisplay([d(1, true)], null, 1)).toBeNull()
  expect(pickProjectionDisplay([d(1, true)], 2, 1)).toBeNull()
})
test('monitor salvo válido e diferente do operador é usado', () => {
  expect(pickProjectionDisplay([d(1, true), d(2), d(3)], 3, 1)).toBe(3)
})
test('monitor salvo sumiu: usa outro monitor que não seja o do operador', () => {
  expect(pickProjectionDisplay([d(1, true), d(2)], 9, 1)).toBe(2)
})
test('monitor salvo igual ao do operador é ignorado', () => {
  expect(pickProjectionDisplay([d(1, true), d(2)], 1, 1)).toBe(2)
})
test('sem monitor salvo escolhe o primeiro que não é do operador', () => {
  expect(pickProjectionDisplay([d(1, true), d(2), d(3)], null, 1)).toBe(2)
})
