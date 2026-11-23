// Converte um arquivo "verse per line" do eBible.org (ex.: porbr2018_vpl.txt, Bíblia Livre)
// para o formato JSON do Sonora.
//
// Uso: node scripts/convert-bible.mjs <entrada_vpl.txt> <saida.json> [id] [nome] [licença]
// Fonte da Bíblia Livre: https://ebible.org/Scriptures/porbr2018_vpl.zip
import { readFileSync, writeFileSync } from 'node:fs'
import { BOOKS } from '../src/shared/bibleRef.ts'

const [input, output, id = 'BLIVRE', name = 'Bíblia Livre', license = 'CC BY 4.0'] = process.argv.slice(2)
if (!input || !output) {
  console.error('Uso: node scripts/convert-bible.mjs <entrada_vpl.txt> <saida.json> [id] [nome] [licença]')
  process.exit(1)
}

// códigos do eBible -> USFM (apenas os que diferem)
const EBIBLE_TO_USFM = {
  SOL: 'SNG', EZE: 'EZK', JOE: 'JOL', MAR: 'MRK', LUK: 'LUK', JOH: 'JHN',
  PHI: 'PHP', JAM: 'JAS', '1JO': '1JN', '2JO': '2JN', '3JO': '3JN', NAH: 'NAM'
}

const byBook = new Map()
for (const line of readFileSync(input, 'utf8').split(/\r?\n/)) {
  const m = /^(\w{3}) (\d+):(\d+) (.*)$/.exec(line)
  if (!m) continue
  const bookId = EBIBLE_TO_USFM[m[1]] ?? m[1]
  const chapter = Number(m[2])
  const verse = Number(m[3])
  const chapters = byBook.get(bookId) ?? []
  const verses = (chapters[chapter - 1] ??= [])
  if (verse !== verses.length + 1) throw new Error(`Versículo fora de ordem: ${line.slice(0, 30)}`)
  verses.push(m[4].trim())
  byBook.set(bookId, chapters)
}

const books = BOOKS.filter((b) => byBook.has(b.id)).map((b) => {
  const chapters = byBook.get(b.id)
  if (chapters.some((c) => !c)) throw new Error(`Capítulo ausente em ${b.id}`)
  return { id: b.id, name: b.name, abbrev: b.abbrev, chapters }
})
const missing = [...byBook.keys()].filter((k) => !BOOKS.some((b) => b.id === k))
if (missing.length) throw new Error(`Livros sem mapeamento: ${missing.join(', ')}`)

writeFileSync(output, JSON.stringify({ id, name, license, books }))
console.log(`${books.length} livros, ${books.reduce((n, b) => n + b.chapters.reduce((a, c) => a + c.length, 0), 0)} versículos -> ${output}`)
