export interface Size {
  width: number
  height: number
}

/** Maior tamanho inteiro (px) entre minPx e maxPx cujo texto medido cabe em `box`; minPx se nem ele couber. */
export function fitFontSize(
  measure: (px: number) => Size,
  box: Size,
  minPx: number,
  maxPx: number
): number {
  const fits = (px: number): boolean => {
    const m = measure(px)
    return m.width <= box.width && m.height <= box.height
  }
  let lo = Math.floor(minPx)
  let hi = Math.floor(maxPx)
  if (hi <= lo) return lo
  if (!fits(lo)) return lo
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (fits(mid)) lo = mid
    else hi = mid - 1
  }
  return lo
}

/** Piso absoluto (px) usado só em último recurso, abaixo de minPx. */
export const ABSOLUTE_MIN_PX = 12

/**
 * Como fitFontSize, mas se nem minPx cabe, continua abaixo dele (busca binária)
 * até `floorPx`; se nem o piso cabe, retorna o piso.
 */
export function fitFontSizeWithFloor(
  measure: (px: number) => Size,
  box: Size,
  minPx: number,
  maxPx: number,
  floorPx: number = ABSOLUTE_MIN_PX
): number {
  const size = fitFontSize(measure, box, minPx, maxPx)
  const m = measure(size)
  if (m.width <= box.width && m.height <= box.height) return size
  const floor = Math.min(Math.floor(floorPx), size)
  return fitFontSize(measure, box, floor, size - 1 < floor ? floor : size - 1)
}
