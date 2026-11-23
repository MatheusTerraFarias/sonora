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
