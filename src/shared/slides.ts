import type { ResolvedItem, Slide, Song } from './types'

export interface Passage {
  /** referência do trecho, ex.: "João 3:16-17" */
  title: string
  verses: { n: number; text: string }[]
  /** nome do livro e capítulo: permitem titular cada slide com o seu próprio intervalo */
  book?: string
  chapter?: number
}

/** Quebra `text` em pedaços de até `max` caracteres, sempre em fronteira de palavra quando possível. */
function splitText(text: string, max: number): string[] {
  const out: string[] = []
  let rest = text
  while (rest.length > max) {
    const chunks = Math.ceil(rest.length / max)
    const target = Math.min(max, Math.ceil(rest.length / chunks))
    // espaço mais próximo do ponto ideal, sem passar de `max`
    let cut = -1
    for (let d = 0; d <= max; d++) {
      if (target - d > 0 && rest[target - d] === ' ') { cut = target - d; break }
      if (d > 0 && target + d <= max && rest[target + d] === ' ') { cut = target + d; break }
    }
    if (cut <= 0) cut = max
    out.push(rest.slice(0, cut).trimEnd())
    rest = rest.slice(cut).trimStart()
  }
  if (rest) out.push(rest)
  return out
}

/** Agrupa versículos em slides de até `maxChars` caracteres. */
export function bibleSlides(passage: Passage, maxChars = 400): Slide[] {
  const { book, chapter } = passage
  const titleFor = (first: number, last: number): string =>
    book === undefined || chapter === undefined
      ? passage.title
      : `${book} ${chapter}:${first === last ? first : `${first}-${last}`}`

  const slides: Slide[] = []
  let group: { n: number; line: string }[] = []
  let size = 0

  const flush = (): void => {
    if (!group.length) return
    slides.push({
      label: 'Bíblia',
      text: group.map((g) => g.line).join('\n'),
      title: titleFor(group[0].n, group[group.length - 1].n)
    })
    group = []
    size = 0
  }

  for (const v of passage.verses) {
    const line = `${v.n} ${v.text}`
    if (line.length > maxChars) {
      flush()
      for (const piece of splitText(line, maxChars)) {
        slides.push({ label: 'Bíblia', text: piece, title: titleFor(v.n, v.n) })
      }
      continue
    }
    const added = line.length + (group.length ? 1 : 0)
    if (group.length && size + added > maxChars) flush()
    size += line.length + (group.length ? 1 : 0)
    group.push({ n: v.n, line })
  }
  flush()
  return slides
}

export interface SlideDeps {
  song(id: string): Song | null
  passage(translation: string, ref: string): Passage | null
}

/** Slides de um item do culto. Mídia, YouTube e itens ausentes não têm slides. */
export function buildSlides(resolved: ResolvedItem, deps: SlideDeps): Slide[] {
  if (resolved.missing) return []
  const d = resolved.item.data
  switch (d.kind) {
    case 'song': {
      const song = deps.song(d.songId)
      if (!song) return []
      const out: Slide[] = []
      for (const partId of song.arrangement) {
        const part = song.parts.find((p) => p.id === partId)
        if (part) for (const text of part.slides) out.push({ label: part.label, text })
      }
      return out
    }
    case 'bible': {
      const p = deps.passage(d.translation, d.ref)
      return p ? bibleSlides(p) : []
    }
    case 'notice':
      return [{ label: 'Aviso', title: d.title, text: d.body }]
    default:
      return []
  }
}
