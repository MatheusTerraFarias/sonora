import { channelStatus, measure, stepTrack, type MeterTrack } from '../../../shared/meter'

export type EngineState =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; deviceLabel: string; inputCount: number }
  | { kind: 'error'; reason: 'permission' | 'busy' | 'not-found' | 'disconnected' | 'unknown' }

export interface InputReading {
  rmsDb: number
  peakDb: number
  status: 'signal' | 'no-signal' | 'clip'
}

export interface MeterEngine {
  /** Abre a captura (reinicia se já estava aberta). Nunca lança: falhas viram estado `error`. */
  start(deviceId: string | null): Promise<void>
  stop(): void
  onState(cb: (s: EngineState) => void): () => void
  /** ~30 Hz enquanto `running`. */
  onFrame(cb: (inputs: InputReading[]) => void): () => void
}

export interface MeterEngineDeps {
  mediaDevices: MediaDevices
  createContext: () => AudioContext
  now: () => number
  /** Agenda UM quadro (~33 ms) e devolve o cancelamento; o motor reagenda a cada quadro. */
  schedule: (cb: () => void) => () => void
}

export const RETRY_MS = 3000
const FFT_SIZE = 2048

interface Session {
  stream: MediaStream
  context: AudioContext
  track: MediaStreamTrack
  analysers: AnalyserNode[]
  buffers: Float32Array[]
  tracks: Array<MeterTrack | null>
  onEnded: () => void
}

function mapError(err: unknown): 'permission' | 'busy' | 'not-found' | 'unknown' {
  const name = (err as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission'
  if (name === 'NotReadableError') return 'busy'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'not-found'
  return 'unknown'
}

export function createMeterEngine(deps: MeterEngineDeps): MeterEngine {
  const stateCbs = new Set<(s: EngineState) => void>()
  const frameCbs = new Set<(i: InputReading[]) => void>()
  let state: EngineState = { kind: 'idle' }
  let session: Session | null = null
  let wanted = false
  let deviceId: string | null = null
  /** invalida aberturas em andamento quando chega stop()/novo start() */
  let generation = 0
  let opening = false
  let cancelFrame: (() => void) | null = null
  let lastAttemptAt = 0
  let deviceListening = false

  function setState(s: EngineState): void {
    state = s
    for (const cb of [...stateCbs]) cb(s)
  }

  function releaseSession(): void {
    const s = session
    session = null
    if (!s) return
    s.track.removeEventListener('ended', s.onEnded)
    for (const t of s.stream.getTracks()) t.stop()
    void s.context.close().catch(() => undefined)
  }

  function stopFrames(): void {
    cancelFrame?.()
    cancelFrame = null
  }

  function onDeviceChange(): void {
    if (!wanted || !session || deviceId === null) return
    const gen = generation
    deps.mediaDevices
      .enumerateDevices()
      .then((list) => {
        if (gen !== generation || !session) return
        if (!list.some((d) => d.kind === 'audioinput' && d.deviceId === deviceId)) disconnect()
      })
      .catch(() => undefined)
  }

  function listenDevices(on: boolean): void {
    if (on === deviceListening) return
    deviceListening = on
    if (on) deps.mediaDevices.addEventListener('devicechange', onDeviceChange)
    else deps.mediaDevices.removeEventListener('devicechange', onDeviceChange)
  }

  /** Perdeu o dispositivo: solta tudo, mas continua "querendo" e tenta de novo a cada 3 s (no laço de quadros). */
  function disconnect(): void {
    if (!wanted) return
    releaseSession()
    lastAttemptAt = deps.now()
    setState({ kind: 'error', reason: 'disconnected' })
    armFrame()
  }

  function armFrame(): void {
    if (cancelFrame || !wanted) return
    cancelFrame = deps.schedule(() => {
      cancelFrame = null
      if (!wanted) return
      try {
        tick()
      } catch (err) {
        console.warn('[sonora] erro no medidor:', err)
        releaseSession()
        setState({ kind: 'error', reason: 'unknown' })
        return
      }
      armFrame()
    })
  }

  function tick(): void {
    const now = deps.now()
    const s = session
    if (!s) {
      if (state.kind === 'error' && state.reason === 'disconnected' && !opening && now - lastAttemptAt >= RETRY_MS) {
        lastAttemptAt = now
        void open(true)
      }
      return
    }
    const out: InputReading[] = new Array(s.analysers.length)
    for (let i = 0; i < s.analysers.length; i++) {
      s.analysers[i].getFloatTimeDomainData(s.buffers[i] as Float32Array<ArrayBuffer>)
      const m = measure(s.buffers[i])
      const track = stepTrack(s.tracks[i], m, now)
      s.tracks[i] = track
      out[i] = { rmsDb: m.rmsDb, peakDb: track.peakDb, status: channelStatus(track, now) }
    }
    for (const cb of [...frameCbs]) cb(out)
  }

  async function open(isRetry: boolean): Promise<void> {
    const gen = ++generation
    opening = true
    if (!isRetry) setState({ kind: 'starting' })
    let stream: MediaStream | null = null
    try {
      stream = await deps.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          // NUNCA ligar echoCancellation/noiseSuppression/autoGainControl: além de distorcer a medição,
          // no Windows o processamento de voz pode abaixar (ducking) o volume dos outros apps, ou seja,
          // o som do telão. A captura é só leitura e não pode afetar a projeção.
          channelCount: { ideal: 32 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      })
    } catch (err) {
      if (gen !== generation) return
      opening = false
      const reason = mapError(err)
      // dispositivo escolhido ausente (ex.: mesa desligada ao abrir a tela): volta sozinho quando reaparecer
      const missing = reason === 'not-found' && deviceId !== null
      if ((isRetry && reason !== 'permission') || missing) {
        // segue desconectado; o laço tenta de novo em 3 s
        lastAttemptAt = deps.now()
        if (!(state.kind === 'error' && state.reason === 'disconnected')) setState({ kind: 'error', reason: 'disconnected' })
        listenDevices(true)
        armFrame()
        return
      }
      wanted = reason === 'permission' ? false : wanted
      if (!wanted) stopFrames()
      listenDevices(wanted)
      setState({ kind: 'error', reason })
      return
    }
    if (gen !== generation || !wanted) {
      for (const t of stream.getTracks()) t.stop()
      return
    }
    opening = false
    let context: AudioContext | null = null
    try {
      const track = stream.getAudioTracks()[0]
      const inputCount = Math.max(1, track.getSettings().channelCount ?? 1)
      context = deps.createContext()
      if (context.state === 'suspended') void context.resume().catch(() => undefined)
      const source = context.createMediaStreamSource(stream)
      const splitter = context.createChannelSplitter(inputCount)
      source.connect(splitter)
      const analysers: AnalyserNode[] = []
      for (let i = 0; i < inputCount; i++) {
        const a = context.createAnalyser()
        a.fftSize = FFT_SIZE
        // só leitura: nada vai para context.destination (sem retorno de som)
        splitter.connect(a, i)
        analysers.push(a)
      }
      const onEnded = (): void => {
        if (session && session.stream === stream) disconnect()
      }
      track.addEventListener('ended', onEnded)
      session = {
        stream,
        context,
        track,
        analysers,
        buffers: analysers.map(() => new Float32Array(FFT_SIZE)),
        tracks: analysers.map(() => null),
        onEnded
      }
      setState({ kind: 'running', deviceLabel: track.label || '', inputCount })
      armFrame()
    } catch (err) {
      console.warn('[sonora] falha ao montar o medidor:', err)
      for (const t of stream.getTracks()) t.stop()
      releaseSession()
      void context?.close().catch(() => undefined)
      setState({ kind: 'error', reason: 'unknown' })
    }
  }

  return {
    async start(id) {
      this.stop()
      wanted = true
      deviceId = id
      listenDevices(true)
      await open(false)
    },
    stop() {
      generation++
      wanted = false
      opening = false
      stopFrames()
      listenDevices(false)
      releaseSession()
      if (state.kind !== 'idle') setState({ kind: 'idle' })
    },
    onState(cb) {
      stateCbs.add(cb)
      return () => stateCbs.delete(cb)
    },
    onFrame(cb) {
      frameCbs.add(cb)
      return () => frameCbs.delete(cb)
    }
  }
}
