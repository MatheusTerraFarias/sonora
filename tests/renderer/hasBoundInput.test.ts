import { expect, test } from 'vitest'
import { hasBoundInput } from '../../src/renderer/operator/sound/bindChannels'
import type { SoundChannel } from '../../src/shared/sound'

const ch = (inputIndex: number | null): SoundChannel => ({ id: 'x', number: 1, name: '', person: '', kind: 'wired', notes: '', inputIndex })

test('só liga a captura se algum canal tem entrada', () => {
  expect(hasBoundInput([])).toBe(false)
  expect(hasBoundInput([ch(null), ch(null)])).toBe(false)
  expect(hasBoundInput([ch(null), ch(0)])).toBe(true)
  expect(hasBoundInput([ch(3)])).toBe(true)
})
