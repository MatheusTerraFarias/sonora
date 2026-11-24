import { expect, test } from 'vitest'
import { allowMediaPermission } from '../../src/main/windows/mediaPermission'

const op = 1
const base = { permission: 'media', requesterId: op, operatorId: op }

test('microfone só para o operador', () => {
  expect(allowMediaPermission({ ...base, mediaTypes: ['audio'] })).toBe(true)
  expect(allowMediaPermission({ ...base, requesterId: 2, mediaTypes: ['audio'] })).toBe(false)
  expect(allowMediaPermission({ ...base, requesterId: null, mediaTypes: ['audio'] })).toBe(false)
  expect(allowMediaPermission({ ...base, operatorId: null, mediaTypes: ['audio'] })).toBe(false)
})

test('vídeo é negado, mesmo para o operador', () => {
  expect(allowMediaPermission({ ...base, mediaTypes: ['audio', 'video'] })).toBe(false)
  expect(allowMediaPermission({ ...base, mediaTypes: ['video'] })).toBe(false)
  expect(allowMediaPermission({ ...base, mediaType: 'video' })).toBe(false)
})

test('verificação sem tipo (listar dispositivos) vale para o operador', () => {
  expect(allowMediaPermission({ ...base, mediaType: 'unknown' })).toBe(true)
  expect(allowMediaPermission({ ...base, mediaType: 'audio' })).toBe(true)
  expect(allowMediaPermission({ ...base })).toBe(true)
})

test('outras permissões são negadas', () => {
  expect(allowMediaPermission({ ...base, permission: 'geolocation' })).toBe(false)
  expect(allowMediaPermission({ ...base, permission: 'notifications' })).toBe(false)
})
