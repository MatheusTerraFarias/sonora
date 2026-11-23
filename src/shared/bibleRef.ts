export interface BookInfo {
  /** código estilo USFM (GEN, PSA, JHN, 1CO…) */
  id: string
  name: string
  /** abreviações aceitas (além do nome), já sem acento */
  abbrev: string[]
}

export interface BibleRef {
  bookId: string
  chapter: number
  verseStart: number | null
  verseEnd: number | null
}

const b = (id: string, name: string, ...abbrev: string[]): BookInfo => ({ id, name, abbrev })

export const BOOKS: BookInfo[] = [
  b('GEN', 'Gênesis', 'gn', 'ge', 'gen'),
  b('EXO', 'Êxodo', 'ex', 'exo', 'exd'),
  b('LEV', 'Levítico', 'lv', 'le', 'lev'),
  b('NUM', 'Números', 'nm', 'nu', 'num'),
  b('DEU', 'Deuteronômio', 'dt', 'de', 'deu'),
  b('JOS', 'Josué', 'js', 'jos'),
  b('JDG', 'Juízes', 'jz', 'jui', 'jdg'),
  b('RUT', 'Rute', 'rt', 'ru', 'rut'),
  b('1SA', '1 Samuel', '1sm', '1sa', '1s'),
  b('2SA', '2 Samuel', '2sm', '2sa', '2s'),
  b('1KI', '1 Reis', '1rs', '1re', '1r'),
  b('2KI', '2 Reis', '2rs', '2re', '2r'),
  b('1CH', '1 Crônicas', '1cr', '1ch', '1cro'),
  b('2CH', '2 Crônicas', '2cr', '2ch', '2cro'),
  b('EZR', 'Esdras', 'esd', 'ed', 'ezr'),
  b('NEH', 'Neemias', 'ne', 'nee', 'neh'),
  b('EST', 'Ester', 'et', 'es', 'est'),
  b('JOB', 'Jó', 'job', 'jb'),
  b('PSA', 'Salmos', 'sl', 'sal', 'salmo', 'ps', 'psa'),
  b('PRO', 'Provérbios', 'pv', 'pr', 'pro', 'prov'),
  b('ECC', 'Eclesiastes', 'ec', 'ecl', 'ecle'),
  b('SNG', 'Cantares', 'ct', 'cant', 'cantares de salomao', 'cantico dos canticos', 'canticos', 'sng'),
  b('ISA', 'Isaías', 'is', 'isa'),
  b('JER', 'Jeremias', 'jr', 'je', 'jer'),
  b('LAM', 'Lamentações', 'lm', 'la', 'lam'),
  b('EZK', 'Ezequiel', 'ez', 'eze', 'ezq', 'ezk'),
  b('DAN', 'Daniel', 'dn', 'da', 'dan'),
  b('HOS', 'Oseias', 'os', 'hos'),
  b('JOL', 'Joel', 'jl', 'joe'),
  b('AMO', 'Amós', 'am', 'amo'),
  b('OBA', 'Obadias', 'ob', 'oba', 'abdias'),
  b('JON', 'Jonas', 'jn', 'jon'),
  b('MIC', 'Miqueias', 'mq', 'mi', 'miq', 'mic'),
  b('NAM', 'Naum', 'na', 'nau', 'nam'),
  b('HAB', 'Habacuque', 'hc', 'hab'),
  b('ZEP', 'Sofonias', 'sf', 'sof', 'zep'),
  b('HAG', 'Ageu', 'ag', 'age', 'hag'),
  b('ZEC', 'Zacarias', 'zc', 'za', 'zac', 'zec'),
  b('MAL', 'Malaquias', 'ml', 'mal'),
  b('MAT', 'Mateus', 'mt', 'mat'),
  b('MRK', 'Marcos', 'mc', 'mar', 'mrk'),
  b('LUK', 'Lucas', 'lc', 'luc', 'luk'),
  b('JHN', 'João', 'jo', 'joa', 'jhn'),
  b('ACT', 'Atos', 'at', 'ato', 'act', 'atos dos apostolos'),
  b('ROM', 'Romanos', 'rm', 'ro', 'rom'),
  b('1CO', '1 Coríntios', '1co', '1cor'),
  b('2CO', '2 Coríntios', '2co', '2cor'),
  b('GAL', 'Gálatas', 'gl', 'ga', 'gal'),
  b('EPH', 'Efésios', 'ef', 'efe', 'eph'),
  b('PHP', 'Filipenses', 'fp', 'fl', 'fil', 'php'),
  b('COL', 'Colossenses', 'cl', 'col'),
  b('1TH', '1 Tessalonicenses', '1ts', '1te', '1tes', '1th'),
  b('2TH', '2 Tessalonicenses', '2ts', '2te', '2tes', '2th'),
  b('1TI', '1 Timóteo', '1tm', '1ti', '1tim'),
  b('2TI', '2 Timóteo', '2tm', '2ti', '2tim'),
  b('TIT', 'Tito', 'tt', 'tit'),
  b('PHM', 'Filemom', 'fm', 'flm', 'filemon', 'phm'),
  b('HEB', 'Hebreus', 'hb', 'he', 'heb'),
  b('JAS', 'Tiago', 'tg', 'tia', 'jas'),
  b('1PE', '1 Pedro', '1pd', '1pe', '1ped'),
  b('2PE', '2 Pedro', '2pd', '2pe', '2ped'),
  b('1JN', '1 João', '1jo', '1joa', '1jn'),
  b('2JN', '2 João', '2jo', '2joa', '2jn'),
  b('3JN', '3 João', '3jo', '3joa', '3jn'),
  b('JUD', 'Judas', 'jd', 'jud'),
  b('REV', 'Apocalipse', 'ap', 'apo', 'apoc', 'rev')
]

/** minúsculas e sem acentos */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const squash = (s: string): string => fold(s).replace(/[\s.]/g, '')

const bookByName = new Map<string, string>()
for (const book of BOOKS) for (const a of book.abbrev) bookByName.set(squash(a), book.id)
// nomes completos têm prioridade sobre abreviações
for (const book of BOOKS) bookByName.set(squash(book.name), book.id)
// "Jó" sem acento colide com "Jo"; "Jo" é João
bookByName.set('jo', 'JHN')

export function bookName(id: string): string {
  return BOOKS.find((x) => x.id === id)?.name ?? id
}

const REF = /^(\d?\s*[a-z][a-z\s.]*?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?$/

export function parseReference(input: string): BibleRef | null {
  const m = REF.exec(fold(input).trim())
  if (!m) return null
  const bookId = bookByName.get(squash(m[1]))
  if (!bookId) return null
  const chapter = Number(m[2])
  if (m[3] === undefined) return { bookId, chapter, verseStart: null, verseEnd: null }
  const verseStart = Number(m[3])
  const verseEnd = m[4] === undefined ? verseStart : Number(m[4])
  return { bookId, chapter, verseStart, verseEnd }
}

/** "João 3:16", "João 3:16-17", "Salmos 23" */
export function formatReference(
  bookId: string,
  chapter: number,
  verseStart: number | null,
  verseEnd: number | null
): string {
  const base = `${bookName(bookId)} ${chapter}`
  if (verseStart === null) return base
  return verseEnd === null || verseEnd === verseStart ? `${base}:${verseStart}` : `${base}:${verseStart}-${verseEnd}`
}
