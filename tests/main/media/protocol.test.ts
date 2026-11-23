import { expect, test } from 'vitest'
import { resolveMediaRequest } from '../../../src/main/media/protocol'

const repo = { filePath: (id: string) => (id === 'abc-123' ? 'C:/m/abc-123.mp4' : null) }

test('resolve id conhecido', () => {
  expect(resolveMediaRequest('sonora-media://abc-123', repo)).toBe('C:/m/abc-123.mp4')
  expect(resolveMediaRequest('sonora-media://abc-123/', repo)).toBe('C:/m/abc-123.mp4')
})

test('id desconhecido ou URL malformada -> null', () => {
  expect(resolveMediaRequest('sonora-media://nope', repo)).toBeNull()
  expect(resolveMediaRequest('not a url', repo)).toBeNull()
  expect(resolveMediaRequest('http://abc-123', repo)).toBeNull()
  expect(resolveMediaRequest('sonora-media://', repo)).toBeNull()
})

test('sem path traversal: só ids são aceitos', () => {
  expect(resolveMediaRequest('sonora-media://abc-123/../../secret', repo)).toBeNull()
  expect(resolveMediaRequest('sonora-media://..%2F..%2Fsecret', repo)).toBeNull()
  expect(resolveMediaRequest('sonora-media://abc-123%2F..', repo)).toBeNull()
  expect(resolveMediaRequest('sonora-media://C:/Windows/win.ini', repo)).toBeNull()
})
