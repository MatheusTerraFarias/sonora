import { useEffect, useMemo, useRef, useState } from 'react'
import type { ID } from '../../../shared/types'
import type { SoundChannel } from '../../../shared/sound'
import { createMeterEngine, type EngineState, type InputReading } from './meterEngine'
import { bindChannels } from './bindChannels'

const FRAME_MS = 33

/**
 * Medidores da tela Som. A captura abre ao montar (tela aberta) e fecha ao desmontar;
 * trocar `channels` só refaz a ligação canal -> entrada, sem reiniciar a captura.
 * Trocar o dispositivo nas configurações reabre a captura. Nada fora desta tela mede áudio.
 */
export function useMeters(channels: SoundChannel[]): {
  state: EngineState
  byChannel: Record<ID, InputReading | 'no-input'>
} {
  const [state, setState] = useState<EngineState>({ kind: 'idle' })
  const [inputs, setInputs] = useState<InputReading[]>([])
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    const engine = createMeterEngine({
      mediaDevices: navigator.mediaDevices,
      createContext: () => new AudioContext(),
      now: () => performance.now(),
      schedule: (cb) => {
        const t = setTimeout(cb, FRAME_MS)
        return () => clearTimeout(t)
      }
    })
    const offState = engine.onState((s) => {
      if (!alive.current) return
      setState(s)
      if (s.kind !== 'running') setInputs([])
    })
    const offFrame = engine.onFrame((f) => alive.current && setInputs(f))
    let current: string | null | undefined
    const apply = (id: string | null): void => {
      if (id === current) return
      current = id
      void engine.start(id)
    }
    window.sonora.settings
      .get()
      .then((s) => alive.current && apply(s.soundInputDeviceId))
      .catch(() => alive.current && apply(null))
    const offSettings = window.sonora.settings.onChange((s) => alive.current && apply(s.soundInputDeviceId))
    return () => {
      alive.current = false
      offSettings()
      offFrame()
      offState()
      engine.stop()
    }
  }, [])

  const byChannel = useMemo(() => bindChannels(channels, inputs), [channels, inputs])
  return { state, byChannel }
}
