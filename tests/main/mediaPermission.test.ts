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

// telão (janela de projeção): a saída de áudio escolhida (setSinkId) depende da VERIFICAÇÃO de permissão
const tel = { permission: 'media', requesterId: 5, operatorId: 1, projectionId: 5 }

test('telão: verificação de media/áudio e speaker-selection são permitidas', () => {
  expect(allowMediaPermission({ ...tel, check: true, mediaType: 'audio' })).toBe(true)
  expect(allowMediaPermission({ ...tel, check: true, mediaType: 'unknown' })).toBe(true)
  expect(allowMediaPermission({ ...tel, check: true })).toBe(true)
  expect(allowMediaPermission({ ...tel, permission: 'speaker-selection', check: true })).toBe(true)
  expect(allowMediaPermission({ ...tel, permission: 'speaker-selection' })).toBe(true)
})

test('telão: pedido de captura (getUserMedia) e vídeo continuam negados', () => {
  expect(allowMediaPermission({ ...tel, mediaTypes: ['audio'] })).toBe(false)
  expect(allowMediaPermission({ ...tel, check: true, mediaType: 'video' })).toBe(false)
  expect(allowMediaPermission({ ...tel, mediaTypes: ['video'] })).toBe(false)
})

test('speaker-selection só para o operador e o telão; outros negados', () => {
  expect(allowMediaPermission({ ...base, permission: 'speaker-selection', check: true })).toBe(true)
  expect(allowMediaPermission({ ...base, permission: 'speaker-selection', requesterId: 9, projectionId: 5, check: true })).toBe(false)
  expect(allowMediaPermission({ ...base, permission: 'speaker-selection', requesterId: null, check: true })).toBe(false)
})

test('operador com projectionId definido segue funcionando', () => {
  expect(allowMediaPermission({ ...base, projectionId: 5, mediaTypes: ['audio'] })).toBe(true)
})
