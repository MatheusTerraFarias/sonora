import { describe, expect, it } from 'vitest'
import { FOOTER_GAP, LINE_HEIGHT, SAFE, footerFontPx, slideLayout } from '../../src/shared/slideLayout'

describe('slideLayout', () => {
  it('sem rodapé usa a área segura inteira, centralizada', () => {
    const l = slideLayout(1920, 1080, false)
    expect(l.textWidth).toBeCloseTo(1920 * SAFE)
    expect(l.textHeight).toBeCloseTo(1080 * SAFE)
    expect(l.textTop).toBeCloseTo(l.textBottom)
    expect(l.footerBand).toBe(0)
  })

  it('com rodapé, a área do texto termina acima da faixa do rodapé, com respiro', () => {
    const l = slideLayout(1920, 1080, true)
    const footerTop = l.footerBottom + l.footerPx * LINE_HEIGHT
    // a base do texto fica acima do topo do rodapé, separada pelo respiro
    expect(l.textBottom - footerTop).toBeCloseTo(1080 * FOOTER_GAP)
    expect(l.textHeight).toBeLessThan(1080 * SAFE)
    expect(l.textTop + l.textHeight + l.textBottom).toBeCloseTo(1080)
  })

  it('minFooterBand só aumenta a faixa', () => {
    const base = slideLayout(1920, 1080, true)
    expect(slideLayout(1920, 1080, true, 10).footerBand).toBe(base.footerBand)
    expect(slideLayout(1920, 1080, true, 200).textBottom).toBe(200)
    expect(slideLayout(1920, 1080, false, 200).footerBand).toBe(0)
  })

  it('fonte do rodapé tem piso de 16px', () => {
    expect(footerFontPx(1080)).toBe(32)
    expect(footerFontPx(300)).toBe(16)
  })
})
