import { beforeEach, expect, test } from 'vitest'
import { createMeterEngine, type EngineState, type InputReading } from '../../src/renderer/operator/sound/meterEngine'
import { bindChannels } from '../../src/renderer/operator/sound/bindChannels'
import type { SoundChannel } from '../../src/shared/sound'

class FakeTrack {
  stopped = false
  endedCb: (() => void) | null = null
  constructor(private channelCount: number | undefined) {}
  getSettings() {
    return { channelCount: this.channelCount }
  }
  stop() {
    this.stopped = true
  }
  addEventListener(type: string, cb: () => void) {
    if (type === 'ended') this.endedCb = cb
  }
  removeEventListener(type: string) {
    if (type === 'ended') this.endedCb = null
  }
  end() {
    this.endedCb?.()
  }
}

class FakeAnalyser {
  fftSize = 0
  amplitude = 0.1
  buffers = new Set<Float32Array>()
  getFloatTimeDomainData(buf: Float32Array) {
    this.buffers.add(buf)
    buf.fill(this.amplitude)
  }
}

class FakeContext {
  state = 'running'
  closed = false
  analysers: FakeAnalyser[] = []
  destinationConnected = false
  destination = {}
  createMediaStreamSource() {
    return { connect: () => undefined }
  }
  createChannelSplitter() {
    return {
      connect: (target: unknown) => {
        if (target === this.destination) this.destinationConnected = true
      }
    }
  }
  createAnalyser() {
    const a = new FakeAnalyser()
    this.analysers.push(a)
    return a
  }
  close() {
    this.closed = true
    return Promise.resolve()
  }
  resume() {
    return Promise.resolve()
  }
}

let tracks: FakeTrack[]
let contexts: FakeContext[]
let gumCalls: unknown[]
let gumError: string | null
let inputCount: number | undefined
let clock: number
let pending: (() => void) | null
let deviceIds: string[]
let changeCb: (() => void) | null

function makeEngine() {
  const mediaDevices = {
    getUserMedia: async (c: unknown) => {
      gumCalls.push(c)
      if (gumError) throw Object.assign(new Error(gumError), { name: gumError })
      const t = new FakeTrack(inputCount)
      tracks.push(t)
      return {
        getAudioTracks: () => [t],
        getTracks: () => [t]
      }
    },
    enumerateDevices: async () => deviceIds.map((deviceId) => ({ deviceId, kind: 'audioinput', label: `Mesa ${deviceId}` })),
    addEventListener: (_t: string, cb: () => void) => {
      changeCb = cb
    },
    removeEventListener: () => {
      changeCb = null
    }
  }
  return createMeterEngine({
    mediaDevices: mediaDevices as unknown as MediaDevices,
    createContext: () => {
      const c = new FakeContext()
      contexts.push(c)
      return c as unknown as AudioContext
    },
    now: () => clock,
    schedule: (cb) => {
      pending = cb
      return () => {
        if (pending === cb) pending = null
      }
    }
  })
}

/** avança o relógio e roda um quadro */
function frame(ms = 33) {
  clock += ms
  const cb = pending
  pending = null
  cb?.()
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  tracks = []
  contexts = []
  gumCalls = []
  gumError = null
  inputCount = 2
  clock = 1000
  pending = null
  deviceIds = ['mesa']
  changeCb = null
})

function collect(engine: ReturnType<typeof makeEngine>) {
  const states: EngineState[] = []
  const frames: InputReading[][] = []
  engine.onState((s) => states.push(s))
  engine.onFrame((f) => frames.push(f))
  return { states, frames }
}

test('permissão negada vira error/permission', async () => {
  gumError = 'NotAllowedError'
  const e = makeEngine()
  const { states } = collect(e)
  await e.start('mesa')
  expect(states.at(-1)).toEqual({ kind: 'error', reason: 'permission' })
})

test('outros erros do getUserMedia', async () => {
  const cases: Array<[string, string]> = [
    ['NotReadableError', 'busy'],
    ['NotFoundError', 'not-found'],
    ['OverconstrainedError', 'not-found'],
    ['AbortError', 'unknown']
  ]
  for (const [name, reason] of cases) {
    gumError = name
    const e = makeEngine()
    const { states } = collect(e)
    await e.start('mesa')
    expect(states.at(-1)).toEqual({ kind: 'error', reason })
  }
})

test('pede só áudio, sem processamento, com o dispositivo exato', async () => {
  const e = makeEngine()
  await e.start('mesa')
  expect(gumCalls[0]).toEqual({
    audio: {
      deviceId: { exact: 'mesa' },
      channelCount: { ideal: 32 },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false
    }
  })
  await e.start(null)
  expect((gumCalls[1] as { audio: Record<string, unknown> }).audio.deviceId).toBeUndefined()
  e.stop()
})

test('roda com N entradas, um analisador por entrada, nada no destination', async () => {
  inputCount = 3
  const e = makeEngine()
  const { states, frames } = collect(e)
  await e.start('mesa')
  expect(states.at(-1)).toMatchObject({ kind: 'running', inputCount: 3 })
  expect(contexts[0].analysers).toHaveLength(3)
  expect(contexts[0].analysers.every((a) => a.fftSize === 2048)).toBe(true)
  expect(contexts[0].destinationConnected).toBe(false)
  frame()
  expect(frames.at(-1)).toHaveLength(3)
  expect(frames.at(-1)![0].status).toBe('signal')
  e.stop()
})

test('channelCount ausente conta como 1 entrada', async () => {
  inputCount = undefined
  const e = makeEngine()
  const { states } = collect(e)
  await e.start(null)
  expect(states.at(-1)).toMatchObject({ kind: 'running', inputCount: 1 })
  e.stop()
})

test('reaproveita o mesmo buffer a cada quadro', async () => {
  const e = makeEngine()
  await e.start('mesa')
  frame()
  frame()
  frame()
  expect(contexts[0].analysers[0].buffers.size).toBe(1)
  e.stop()
})

test('clip aparece no status', async () => {
  const e = makeEngine()
  const { frames } = collect(e)
  await e.start('mesa')
  contexts[0].analysers[1].amplitude = 1
  frame()
  expect(frames.at(-1)![1].status).toBe('clip')
  e.stop()
})

test('track encerrada vira disconnected e tenta de novo após 3 s', async () => {
  const e = makeEngine()
  const { states } = collect(e)
  await e.start('mesa')
  tracks[0].end()
  expect(states.at(-1)).toEqual({ kind: 'error', reason: 'disconnected' })
  expect(contexts[0].closed).toBe(true)
  expect(gumCalls).toHaveLength(1)
  frame(1000)
  await flush()
  expect(gumCalls).toHaveLength(1)
  frame(2100)
  await flush()
  expect(gumCalls).toHaveLength(2)
  expect(states.at(-1)).toMatchObject({ kind: 'running' })
  e.stop()
})

test('retentativa que falha continua desconectada e tenta de novo depois', async () => {
  const e = makeEngine()
  const { states } = collect(e)
  await e.start('mesa')
  tracks[0].end()
  gumError = 'NotFoundError'
  frame(3100)
  await flush()
  expect(gumCalls).toHaveLength(2)
  expect(states.at(-1)).toEqual({ kind: 'error', reason: 'disconnected' })
  gumError = null
  frame(3100)
  await flush()
  expect(states.at(-1)).toMatchObject({ kind: 'running' })
  e.stop()
})

test('devicechange sem o dispositivo vira disconnected', async () => {
  const e = makeEngine()
  const { states } = collect(e)
  await e.start('mesa')
  deviceIds = []
  changeCb?.()
  await flush()
  expect(states.at(-1)).toEqual({ kind: 'error', reason: 'disconnected' })
  e.stop()
})

test('devicechange com o dispositivo presente não faz nada', async () => {
  const e = makeEngine()
  const { states } = collect(e)
  await e.start('mesa')
  changeCb?.()
  await flush()
  expect(states.at(-1)).toMatchObject({ kind: 'running' })
  e.stop()
})

test('stop fecha o contexto, para as tracks, cancela quadros e retentativas', async () => {
  const e = makeEngine()
  const { states } = collect(e)
  await e.start('mesa')
  e.stop()
  expect(contexts[0].closed).toBe(true)
  expect(tracks[0].stopped).toBe(true)
  expect(states.at(-1)).toEqual({ kind: 'idle' })
  expect(pending).toBeNull()
  expect(changeCb).toBeNull()
  frame(10000)
  await flush()
  expect(gumCalls).toHaveLength(1)
})

test('stop durante o desconectado cancela a retentativa', async () => {
  const e = makeEngine()
  await e.start('mesa')
  tracks[0].end()
  e.stop()
  frame(10000)
  await flush()
  expect(gumCalls).toHaveLength(1)
})

test('stop enquanto getUserMedia está pendente solta o fluxo', async () => {
  const e = makeEngine()
  const p = e.start('mesa')
  e.stop()
  await p
  expect(tracks[0].stopped).toBe(true)
  expect(contexts).toHaveLength(0)
})

const ch = (id: string, inputIndex: number | null) => ({ id, inputIndex }) as SoundChannel

test('inputIndex 0, 1 e 5 com 2 entradas: o terceiro fica sem entrada', () => {
  const inputs: InputReading[] = [
    { rmsDb: -20, peakDb: -10, status: 'signal' },
    { rmsDb: -30, peakDb: -15, status: 'no-signal' }
  ]
  const r = bindChannels([ch('a', 0), ch('b', 1), ch('c', 5), ch('d', null)], inputs)
  expect(r.a).toBe(inputs[0])
  expect(r.b).toBe(inputs[1])
  expect(r.c).toBe('no-input')
  expect(r.d).toBe('no-input')
})

test('sem leituras ainda: tudo sem entrada', () => {
  const r = bindChannels([ch('a', 0)], [])
  expect(r.a).toBe('no-input')
})
