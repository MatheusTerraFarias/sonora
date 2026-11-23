import { afterEach, beforeEach, expect, test } from 'vitest'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createBibleStore } from '../../../src/main/bible/bibleStore'
import { bibleSlides } from '../../../src/shared/slides'

const FIXTURE = resolve(__dirname, '../../fixtures/bible-test.json')
const BUNDLED = resolve(__dirname, '../../../resources/bible')

let root: string
let userDir: string
let bundledDir: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'sonora-bible-'))
  userDir = join(root, 'user')
  bundledDir = join(root, 'bundled')
  mkdirSync(bundledDir)
  copyFileSync(FIXTURE, join(bundledDir, 'TESTE.json'))
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

test('lista traduções do diretório empacotado', () => {
  const store = createBibleStore(userDir, [bundledDir])
  expect(store.translations()).toEqual([
    { id: 'TESTE', name: 'Tradução de Teste', license: 'Domínio público (fixture)' }
  ])
})

test('passagem com versículo, intervalo e capítulo inteiro', () => {
  const store = createBibleStore(userDir, [bundledDir])
  expect(store.passage('TESTE', 'Jo 3:16')).toMatchObject({ title: 'João 3:16', verses: [{ n: 16 }] })
  expect(store.passage('TESTE', 'jo 3.16-17')!.verses.map((v) => v.n)).toEqual([16, 17])
  expect(store.passage('TESTE', 'João 1')!.verses).toHaveLength(2)
  expect(store.passage('TESTE', 'João 1')!.title).toBe('João 1')
})

test('capítulo inexistente → passage null', () => {
  const store = createBibleStore(userDir, [bundledDir])
  expect(store.passage('TESTE', 'Jo 99')).toBeNull()
  expect(store.passage('TESTE', 'Jo 3:99')).toBeNull()
  expect(store.passage('TESTE', 'Xyz 1')).toBeNull()
  expect(store.passage('NAOEXISTE', 'Jo 3:16')).toBeNull()
  expect(store.passage('TESTE', 'Sl 23')).toBeNull() // livro ausente na tradução
})

test('fim do intervalo além do capítulo é limitado', () => {
  const store = createBibleStore(userDir, [bundledDir])
  expect(store.passage('TESTE', 'Jo 3:16-30')!.verses.map((v) => v.n)).toEqual([16, 17])
})

test('busca por palavra sem acento acha versículo com acento', () => {
  const store = createBibleStore(userDir, [bundledDir])
  const r = store.search('TESTE', 'graca')
  expect(r.map((x) => x.ref)).toEqual(['Efésios 1:2', 'Efésios 2:1'])
  expect(r[0].text).toContain('Graça')
})

test('busca com várias palavras exige todas; limite é respeitado', () => {
  const store = createBibleStore(userDir, [bundledDir])
  expect(store.search('TESTE', 'deus amou').map((x) => x.ref)).toEqual(['João 3:16'])
  expect(store.search('TESTE', 'jesus', 2)).toHaveLength(2)
  expect(store.search('TESTE', '')).toEqual([])
})

test('importa tradução para o diretório do usuário', () => {
  const store = createBibleStore(userDir, [bundledDir])
  const file = join(root, 'outra.json')
  writeFileSync(
    file,
    JSON.stringify({
      id: 'OUT',
      name: 'Outra',
      license: 'x',
      books: [{ id: 'JHN', name: 'João', abbrev: [], chapters: [['oi']] }]
    })
  )
  store.importTranslation(file)
  expect(existsSync(join(userDir, 'OUT.json'))).toBe(true)
  expect(store.translations().map((t) => t.id).sort()).toEqual(['OUT', 'TESTE'])
  expect(store.passage('OUT', 'Jo 1:1')!.verses[0].text).toBe('oi')
})

test('importação rejeita arquivo inválido', () => {
  const store = createBibleStore(userDir, [bundledDir])
  const bad = join(root, 'ruim.json')
  writeFileSync(bad, '{"foo": 1}')
  expect(() => store.importTranslation(bad)).toThrow()
  writeFileSync(bad, 'não é json')
  expect(() => store.importTranslation(bad)).toThrow()
})

test('tradução incluída (Bíblia Livre) carrega e é consultável', () => {
  const store = createBibleStore(userDir, [BUNDLED])
  expect(store.translations()).toEqual([{ id: 'BLIVRE', name: 'Bíblia Livre', license: 'CC BY 4.0' }])
  expect(store.passage('BLIVRE', 'Jo 3:16')!.verses[0].text).toContain('Deus amou ao mundo')
  expect(store.passage('BLIVRE', 'Ap 22')).not.toBeNull()
  expect(existsSync(join(BUNDLED, 'LICENSE-BLIVRE.txt'))).toBe(true)
})

test('Salmos 119:1-40 vira vários slides de até 400 caracteres', () => {
  const store = createBibleStore(userDir, [BUNDLED])
  const slides = bibleSlides(store.passage('BLIVRE', 'Salmos 119:1-40')!, 400)
  expect(slides.length).toBeGreaterThan(3)
  for (const s of slides) expect(s.text.length).toBeLessThanOrEqual(400)
  expect(slides[0].title).toMatch(/^Salmos 119:1-/)
})

test('busca na Bíblia Livre: "graca" acha versículos com "graça"', () => {
  const store = createBibleStore(userDir, [BUNDLED])
  const r = store.search('BLIVRE', 'graca')
  expect(r.length).toBe(50)
  expect(r.every((x) => /(^|[^\p{L}])gra[çc]a/iu.test(x.text))).toBe(true)
})
