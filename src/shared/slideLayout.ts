/**
 * Geometria de um slide de texto no telão, compartilhada pelo telão e pelas miniaturas do operador.
 * Com rodapé (`slide.title`), a área do texto termina acima da faixa do rodapé: texto e rodapé nunca se tocam.
 */

/** fração da tela usada pelo texto (área segura) */
export const SAFE = 0.9
export const LINE_HEIGHT = 1.25
/** distância do rodapé até a borda de baixo (fração da altura) */
export const FOOTER_BOTTOM = 0.025
/** respiro entre o texto e o rodapé (fração da altura) */
export const FOOTER_GAP = 0.02

/** tamanho (px) da fonte do rodapé numa tela de altura `h` */
export const footerFontPx = (h: number): number => Math.max(16, Math.round(h * 0.03))

export interface SlideLayout {
  /** caixa onde o texto é ajustado (px) */
  textWidth: number
  textHeight: number
  /** distâncias da área de texto ao topo e à base da tela (px) */
  textTop: number
  textBottom: number
  footerPx: number
  /** distância do rodapé à base da tela (px) */
  footerBottom: number
  /** altura reservada ao rodapé na base (px; 0 sem rodapé) */
  footerBand: number
}

/**
 * Layout de um slide numa tela `w`×`h`. `minFooterBand` permite a uma miniatura reservar mais
 * espaço para um rodapé legível na escala dela (o telão não usa).
 */
export function slideLayout(w: number, h: number, hasFooter: boolean, minFooterBand = 0): SlideLayout {
  const margin = (h * (1 - SAFE)) / 2
  const footerPx = footerFontPx(h)
  const footerBottom = h * FOOTER_BOTTOM
  const band = hasFooter ? Math.max(footerBottom + footerPx * LINE_HEIGHT + h * FOOTER_GAP, minFooterBand) : 0
  const textBottom = Math.max(margin, band)
  return {
    textWidth: w * SAFE,
    textHeight: Math.max(0, h - margin - textBottom),
    textTop: margin,
    textBottom,
    footerPx,
    footerBottom,
    footerBand: band
  }
}
