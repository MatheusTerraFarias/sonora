import { expect, test } from 'vitest'
import { fitFontSize } from '../../src/shared/fitText'

const box = { width: 1000, height: 500 }
// medidor sintético: cada caractere ocupa 0.5*px de largura; N linhas de 1.2*px
const lines = (n: number) => (px: number) => ({ width: 0.5 * px * 10, height: 1.2 * px * n })

test('texto curto usa o tamanho máximo', () => {
  expect(fitFontSize(lines(1), box, 20, 100)).toBe(100)
})

test('texto que só cabe em 50 retorna 50', () => {
  // altura = 1.2*px*8 <= 500 -> px <= 52.08 ; largura 5*px <= 1000 -> px <= 200
  expect(fitFontSize(lines(8), box, 20, 100)).toBe(52)
  expect(fitFontSize((px) => ({ width: px * 20, height: 10 }), box, 20, 100)).toBe(50)
})

test('quando nada cabe retorna o mínimo', () => {
  expect(fitFontSize(lines(100), box, 20, 100)).toBe(20)
})
