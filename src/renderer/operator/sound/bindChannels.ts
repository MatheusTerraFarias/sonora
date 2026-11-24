import type { ID } from '../../../shared/types'
import type { SoundChannel } from '../../../shared/sound'
import type { InputReading } from './meterEngine'

/** Liga cada canal à leitura da sua entrada; sem entrada (nula ou fora do dispositivo) = 'no-input'. */
export function bindChannels(channels: SoundChannel[], inputs: InputReading[]): Record<ID, InputReading | 'no-input'> {
  const out: Record<ID, InputReading | 'no-input'> = {}
  for (const c of channels) {
    const i = c.inputIndex
    out[c.id] = i !== null && i >= 0 && i < inputs.length ? inputs[i] : 'no-input'
  }
  return out
}
