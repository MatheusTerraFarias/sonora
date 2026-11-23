import type { ID, SongPart } from './types'

/** Prefixo dos rótulos automáticos de partes sem marcador ("Parte 1", "Parte 2"...). */
export const AUTO_PART_LABEL_PREFIX = 'Parte'

const MARKER_NAMES = ['Estrofe', 'Verso', 'Refrão', 'Coro', 'Ponte', 'Pré-refrão', 'Intro', 'Final', AUTO_PART_LABEL_PREFIX]
const NAMES_RE = MARKER_NAMES.join('|')
const BRACKET_RE = new RegExp(`^\\[\\s*((?:${NAMES_RE})[^\\]]*?)\\s*\\]$`, 'i')
const COLON_RE = new RegExp(`^((?:${NAMES_RE})[^:]*?)\\s*:$`, 'i')

function markerLabel(line: string): string | null {
  const t = line.trim()
  const m = BRACKET_RE.exec(t) ?? COLON_RE.exec(t)
  return m ? m[1] : null
}

function normalize(text: string): string[] {
  const out: string[] = []
  let blank = false
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (line === '') {
      blank = true
      continue
    }
    if (blank && out.length > 0) out.push('')
    blank = false
    out.push(line)
  }
  return out
}

function toSlides(lines: string[]): string[] {
  const slides: string[] = []
  let cur: string[] = []
  for (const l of lines) {
    if (l === '') {
      if (cur.length) slides.push(cur.join('\n'))
      cur = []
    } else cur.push(l)
  }
  if (cur.length) slides.push(cur.join('\n'))
  return slides
}

const same = (a: string[], b: string[]): boolean => a.length === b.length && a.every((s, i) => s === b[i])
const sameLabel = (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase()

export function parseLyrics(text: string): { parts: Omit<SongPart, 'id'>[]; arrangement: number[] } {
  const lines = normalize(text)
  const sections: { label: string | null; lines: string[] }[] = []
  for (const line of lines) {
    const label = line === '' ? null : markerLabel(line)
    if (label !== null) sections.push({ label, lines: [] })
    else {
      if (!sections.length) sections.push({ label: null, lines: [] })
      sections[sections.length - 1].lines.push(line)
    }
  }

  const parts: Omit<SongPart, 'id'>[] = []
  const arrangement: number[] = []

  if (!sections.some((s) => s.label !== null)) {
    for (const s of sections) {
      for (const slide of toSlides(s.lines)) {
        parts.push({ label: `${AUTO_PART_LABEL_PREFIX} ${parts.length + 1}`, slides: [slide] })
        arrangement.push(parts.length - 1)
      }
    }
    return { parts, arrangement }
  }

  for (const s of sections) {
    const slides = toSlides(s.lines)
    if (s.label === null && slides.length === 0) continue
    const label = s.label ?? `${AUTO_PART_LABEL_PREFIX} ${parts.length + 1}`
    let idx = parts.findIndex((p) => sameLabel(p.label, label) && same(p.slides, slides))
    if (idx < 0 && slides.length === 0) idx = parts.findIndex((p) => sameLabel(p.label, label))
    if (idx < 0) {
      parts.push({ label, slides })
      idx = parts.length - 1
    }
    arrangement.push(idx)
  }
  return { parts, arrangement }
}

/** Inverso de parseLyrics: conteúdo na primeira aparição, só o marcador nas repetições. */
export function serializeLyrics(parts: SongPart[], arrangement: ID[]): string {
  const byId = new Map(parts.map((p) => [p.id, p]))
  const shown = new Set<ID>()
  const blocks: string[] = []
  for (const id of arrangement) {
    const part = byId.get(id)
    if (!part) continue
    const head = `[${part.label}]`
    // repetição só com marcador é segura se o rótulo resolve para esta mesma parte
    const firstWithLabel = parts.find((p) => sameLabel(p.label, part.label))
    if (shown.has(id) && firstWithLabel?.id === id) {
      blocks.push(head)
      continue
    }
    shown.add(id)
    blocks.push([head, part.slides.join('\n\n')].filter((s) => s !== '').join('\n'))
  }
  return blocks.join('\n\n')
}
