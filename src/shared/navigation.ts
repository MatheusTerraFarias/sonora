export interface NavItem {
  slideCount: number
  skip: boolean
}
export interface NavPos {
  item: number
  slide: number
}

/** mídia/YouTube (0 slides) contam como 1 posição */
const positions = (it: NavItem): number => Math.max(1, it.slideCount)

export function nextPosition(items: NavItem[], cur: NavPos): NavPos | null {
  const here = items[cur.item]
  if (here && !here.skip && cur.slide + 1 < positions(here)) return { item: cur.item, slide: cur.slide + 1 }
  for (let i = cur.item + 1; i < items.length; i++) if (!items[i].skip) return { item: i, slide: 0 }
  return null
}

export function prevPosition(items: NavItem[], cur: NavPos): NavPos | null {
  const here = items[cur.item]
  if (here && !here.skip && cur.slide > 0) return { item: cur.item, slide: Math.min(cur.slide, positions(here)) - 1 }
  for (let i = cur.item - 1; i >= 0; i--) if (!items[i].skip) return { item: i, slide: positions(items[i]) - 1 }
  return null
}

/**
 * Próxima posição a partir do cursor. `at` = índice do item atual (-1 sem item);
 * `gap` = posição que o item ao vivo ocupava antes de ser removido do culto (null sem lacuna).
 * Sem item: vai ao primeiro item válido a partir da lacuna (ou do começo).
 */
export function nextFromCursor(items: NavItem[], at: number, slide: number, gap: number | null): NavPos | null {
  if (at >= 0) return nextPosition(items, { item: at, slide })
  for (let i = Math.max(0, gap ?? 0); i < items.length; i++) if (!items[i].skip) return { item: i, slide: 0 }
  return null
}

/** Posição anterior a partir do cursor; sem item e sem lacuna não há para onde voltar. */
export function prevFromCursor(items: NavItem[], at: number, slide: number, gap: number | null): NavPos | null {
  if (at >= 0) return prevPosition(items, { item: at, slide })
  if (gap === null) return null
  for (let i = Math.min(gap, items.length) - 1; i >= 0; i--) if (!items[i].skip) return { item: i, slide: positions(items[i]) - 1 }
  return null
}
