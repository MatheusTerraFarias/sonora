import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { bookName, fold, formatReference, parseReference } from '../../shared/bibleRef'
import type { Passage } from '../../shared/slides'

export interface TranslationInfo {
  id: string
  name: string
  license: string
}

interface BibleBook {
  id: string
  name: string
  abbrev: string[]
  chapters: string[][]
}

interface Translation extends TranslationInfo {
  books: BibleBook[]
}

interface IndexEntry {
  ref: string
  text: string
  folded: string
}

/** texto sem acentos, só letras/dígitos separados por espaço, com espaço inicial (busca por início de palavra) */
const wordsOf = (s: string): string => ' ' + fold(s).replace(/[^a-z0-9]+/g, ' ').trim()

function validate(data: unknown): Translation {
  const t = data as Translation
  const ok =
    t &&
    typeof t.id === 'string' &&
    /^[\w-]+$/.test(t.id) &&
    typeof t.name === 'string' &&
    Array.isArray(t.books) &&
    t.books.every(
      (b) =>
        typeof b.id === 'string' &&
        Array.isArray(b.chapters) &&
        b.chapters.every((c) => Array.isArray(c) && c.every((v) => typeof v === 'string'))
    )
  if (!ok) throw new Error('Arquivo de Bíblia inválido')
  return { id: t.id, name: t.name, license: typeof t.license === 'string' ? t.license : '', books: t.books }
}

function readTranslation(file: string): Translation {
  let data: unknown
  try {
    data = JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    throw new Error('Arquivo de Bíblia inválido: JSON não pôde ser lido')
  }
  return validate(data)
}

/**
 * `userDir`: onde traduções importadas são copiadas (`<userData>/bible`).
 * `bundledDirs`: pastas somente leitura com traduções que acompanham o app.
 */
export function createBibleStore(userDir: string, bundledDirs: string[] = []) {
  let cache: Map<string, Translation> | null = null
  const indexes = new Map<string, IndexEntry[]>()

  function load(): Map<string, Translation> {
    if (cache) return cache
    const map = new Map<string, Translation>()
    for (const dir of [...bundledDirs, userDir]) {
      if (!existsSync(dir)) continue
      for (const f of readdirSync(dir).filter((n) => n.toLowerCase().endsWith('.json')).sort()) {
        try {
          const t = readTranslation(join(dir, f))
          map.set(t.id, t)
        } catch {
          // arquivo inválido na pasta: ignora
        }
      }
    }
    return (cache = map)
  }

  function buildIndex(t: Translation): IndexEntry[] {
    const entries: IndexEntry[] = []
    for (const book of t.books)
      book.chapters.forEach((verses, ci) =>
        verses.forEach((text, vi) =>
          entries.push({ ref: formatReference(book.id, ci + 1, vi + 1, vi + 1), text, folded: wordsOf(text) })
        )
      )
    return entries
  }

  return {
    translations(): TranslationInfo[] {
      return [...load().values()].map(({ id, name, license }) => ({ id, name, license }))
    },

    importTranslation(file: string): TranslationInfo {
      const t = readTranslation(file)
      mkdirSync(userDir, { recursive: true })
      copyFileSync(file, join(userDir, `${t.id}.json`))
      cache = null
      indexes.delete(t.id)
      return { id: t.id, name: t.name, license: t.license }
    },

    passage(translationId: string, ref: string): Passage | null {
      const t = load().get(translationId)
      const r = parseReference(ref)
      if (!t || !r) return null
      const book = t.books.find((b) => b.id === r.bookId)
      const verses = book?.chapters[r.chapter - 1]
      if (!book || !verses || r.chapter < 1) return null
      const start = r.verseStart ?? 1
      if (start < 1 || start > verses.length) return null
      const end = Math.min(r.verseEnd ?? verses.length, verses.length)
      if (end < start) return null
      return {
        title: formatReference(r.bookId, r.chapter, r.verseStart === null ? null : start, r.verseStart === null ? null : end),
        book: bookName(r.bookId),
        chapter: r.chapter,
        verses: verses.slice(start - 1, end).map((text, i) => ({ n: start + i, text }))
      }
    },

    search(translationId: string, words: string, limit = 50): { ref: string; text: string }[] {
      const t = load().get(translationId)
      const tokens = wordsOf(words).split(' ').filter(Boolean)
      if (!t || !tokens.length) return []
      let index = indexes.get(t.id)
      if (!index) indexes.set(t.id, (index = buildIndex(t)))
      const out: { ref: string; text: string }[] = []
      for (const e of index) {
        if (tokens.every((w) => e.folded.includes(' ' + w))) {
          out.push({ ref: e.ref, text: e.text })
          if (out.length >= limit) break
        }
      }
      return out
    }
  }
}

export type BibleStore = ReturnType<typeof createBibleStore>
