import { expect, test } from 'vitest'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { isAppUrl } from '../../src/main/windows/navigationGuard'

const dir = join(process.cwd(), 'out', 'renderer')
const fileBase = pathToFileURL(dir).href

test('dev: só a origem do servidor do renderer', () => {
  expect(isAppUrl('http://localhost:5173/operator/index.html', 'http://localhost:5173', dir)).toBe(true)
  expect(isAppUrl('http://localhost:5174/operator/index.html', 'http://localhost:5173', dir)).toBe(false)
  expect(isAppUrl('https://evil.example/', 'http://localhost:5173', dir)).toBe(false)
})

test('produção: só arquivos dentro de out/renderer', () => {
  expect(isAppUrl(`${fileBase}/operator/index.html`, null, dir)).toBe(true)
  expect(isAppUrl(`${fileBase}/telao/index.html#x`, null, dir)).toBe(true)
  expect(isAppUrl(pathToFileURL(join(dir, '..', 'main', 'index.js')).href, null, dir)).toBe(false)
  expect(isAppUrl(`${fileBase}-outro/x.html`, null, dir)).toBe(false)
  expect(isAppUrl(pathToFileURL('C:/Users/fulano/Desktop/foto.jpg').href, null, dir)).toBe(false)
  expect(isAppUrl('https://www.youtube.com/', null, dir)).toBe(false)
  expect(isAppUrl('não é url', null, dir)).toBe(false)
})
