import { expect, test } from 'vitest'
import { shortcutAction } from '../../src/renderer/operator/shortcuts'

const k = (key: string, targetIsEditable = false) => shortcutAction({ key, targetIsEditable })

test('avançar: seta direita, espaço e PageDown', () => {
  for (const key of ['ArrowRight', ' ', 'PageDown']) expect(k(key)).toBe('next')
})
test('voltar: seta esquerda e PageUp', () => {
  for (const key of ['ArrowLeft', 'PageUp']) expect(k(key)).toBe('prev')
})
test('B preto, C limpar, L logo, Esc tira o overlay (maiúsculas também)', () => {
  expect(k('b')).toBe('black')
  expect(k('B')).toBe('black')
  expect(k('c')).toBe('clear')
  expect(k('C')).toBe('clear')
  expect(k('l')).toBe('logo')
  expect(k('L')).toBe('logo')
  expect(k('Escape')).toBe('none')
})
test('ignora quando o foco está num campo editável', () => {
  for (const key of ['ArrowRight', ' ', 'b', 'Escape']) expect(k(key, true)).toBeNull()
})
test('teclas desconhecidas não fazem nada', () => {
  expect(k('x')).toBeNull()
  expect(k('Enter')).toBeNull()
})
test('ignora com Ctrl/Alt/Meta', () => {
  expect(shortcutAction({ key: 'c', targetIsEditable: false, ctrlKey: true })).toBeNull()
  expect(shortcutAction({ key: 'l', targetIsEditable: false, altKey: true })).toBeNull()
})
