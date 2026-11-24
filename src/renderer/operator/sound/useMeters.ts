import { useCallback, useEffect, useRef, useState } from 'react'
import type { ID } from '../../../shared/types'
import type { SoundChannel } from '../../../shared/sound'
import { createMeterEngine, type EngineState, type InputReading, type MeterEngine } from './meterEngine'
import { bindChannels } from './bindChannels'

const FRAME_MS = 33

/** Leitura de cada canal; null = o motor não está lendo (iniciando, parado ou com erro). */
export type ChannelReadings = Record<ID, InputReading | 'no-input'> | null
export type ReadingsListener = (readings: ChannelReadings) => void

/**
 * Medidores da tela Som. A captura abre ao montar (tela aberta) e fecha ao desmontar;
 * trocar `channels` só refaz a ligação canal -> entrada, sem reiniciar a captura.
 * Trocar o dispositivo nas configurações reabre a captura. Nada fora desta tela mede áudio.
 *
 * Os quadros (~30 Hz) NÃO passam pelo estado do React: quem desenha assina com `subscribe`
 * e escreve direto no DOM. Só `state` (mudança de estado do motor) re-renderiza.
 */
export function useMeters(channels: SoundChannel[]): {
  state: EngineState
  subscribe: (cb: ReadingsListener) => () => void
  retry: () => void
} {
  const [state, setState] = useState<EngineState>({ kind: 'idle' })
  const inputsRef = useRef<InputReading[] | null>(null)
  const channelsRef = useRef(channels)
  const listeners = useRef(new Set<ReadingsListener>())
  const engineRef = useRef<{ engine: MeterEngine; deviceId: () => string | null } | null>(null)

  const notify = useCallback(() => {
    if (listeners.current.size === 0) return
    // nada daqui pode lançar para dentro do laço do motor
    try {
      const inputs = inputsRef.current
      const readings = inputs ? bindChannels(channelsRef.current, inputs) : null
      for (const cb of [...listeners.current]) cb(readings)
    } catch (err) {
      console.warn('[sonora] erro ao distribuir leituras do medidor:', err)
    }
  }, [])

  useEffect(() => {
    channelsRef.current = channels
    notify()
  }, [channels, notify])

  useEffect(() => {
    // por execução do efeito: respostas atrasadas de uma montagem já desfeita (StrictMode) são ignoradas
    let alive = true
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
      if (!alive) return
      setState(s)
      if (s.kind !== 'running') {
        inputsRef.current = null
        notify()
      }
    })
    const offFrame = engine.onFrame((f) => {
      if (!alive) return
      inputsRef.current = f
      notify()
    })
    let current: string | null | undefined
    const apply = (id: string | null): void => {
      if (id === current) return
      current = id
      void engine.start(id)
    }
    engineRef.current = { engine, deviceId: () => current ?? null }
    window.sonora.settings
      .get()
      .then((s) => alive && apply(s.soundInputDeviceId))
      .catch(() => alive && apply(null))
    const offSettings = window.sonora.settings.onChange((s) => alive && apply(s.soundInputDeviceId))
    return () => {
      alive = false
      engineRef.current = null
      offSettings()
      offFrame()
      offState()
      engine.stop()
      inputsRef.current = null
    }
  }, [notify])

  const subscribe = useCallback((cb: ReadingsListener) => {
    listeners.current.add(cb)
    const inputs = inputsRef.current
    cb(inputs ? bindChannels(channelsRef.current, inputs) : null)
    return () => {
      listeners.current.delete(cb)
    }
  }, [])

  /** reabre a captura no mesmo dispositivo (depois de dar permissão, fechar o outro programa...) */
  const retry = useCallback(() => {
    const e = engineRef.current
    if (e) void e.engine.start(e.deviceId())
  }, [])

  return { state, subscribe, retry }
}
