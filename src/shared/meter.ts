/** Piso de leitura (dBFS); silêncio absoluto também cai aqui. */
export const SILENCE_DB = -60
/** Acima disso o canal é considerado quente. */
export const HOT_DB = -6
/** Amostra absoluta a partir da qual há clip (≈ -0,1 dBFS). */
export const CLIP_LEVEL = 0.989
export const CLIP_HOLD_MS = 1500
export const PEAK_HOLD_MS = 1000
export const PEAK_DECAY_DB_PER_S = 20
export const NO_SIGNAL_AFTER_MS = 10000

export interface Measurement {
  rmsDb: number
  peakDb: number
  clipped: boolean
}

/** dBFS com piso em SILENCE_DB; nunca retorna -Infinity nem NaN. */
function toDb(amplitude: number): number {
  if (!(amplitude > 0)) return SILENCE_DB
  return Math.max(SILENCE_DB, 20 * Math.log10(amplitude))
}

export function measure(samples: Float32Array): Measurement {
  let sumSq = 0
  let peak = 0
  let clipped = false
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i])
    sumSq += a * a
    if (a > peak) peak = a
    if (a >= CLIP_LEVEL) clipped = true
  }
  const rms = samples.length > 0 ? Math.sqrt(sumSq / samples.length) : 0
  return { rmsDb: toDb(rms), peakDb: toDb(peak), clipped }
}

export function levelState(rmsDb: number): 'silent' | 'ok' | 'hot' {
  if (rmsDb < SILENCE_DB + 1) return 'silent'
  if (rmsDb >= HOT_DB) return 'hot'
  return 'ok'
}

export type MeterTrack = {
  /** Pico exibido (dBFS). */
  peakDb: number
  /**
   * Referência do decaimento: instante do último pico novo, deslocado para trás
   * por PEAK_HOLD_MS a cada passo em que o decaimento foi aplicado.
   */
  peakAt: number
  /** Clip fica aceso até este instante. */
  clipUntil: number
  /** Último instante com sinal acima do piso de silêncio. */
  lastSignalAt: number
}

export function stepTrack(prev: MeterTrack | null, m: Measurement, now: number): MeterTrack {
  const base: MeterTrack = prev ?? {
    peakDb: SILENCE_DB,
    peakAt: now,
    clipUntil: -Infinity,
    lastSignalAt: now
  }

  let peakDb: number
  let peakAt: number
  if (m.peakDb >= base.peakDb) {
    peakDb = m.peakDb
    peakAt = now
  } else {
    const decayMs = now - base.peakAt - PEAK_HOLD_MS
    if (decayMs > 0) {
      const decayed = Math.max(SILENCE_DB, base.peakDb - (PEAK_DECAY_DB_PER_S * decayMs) / 1000)
      peakDb = Math.max(decayed, m.peakDb)
      // Próximo decaimento parte de agora: a referência anda para trás PEAK_HOLD_MS.
      peakAt = now - PEAK_HOLD_MS
    } else {
      peakDb = base.peakDb
      peakAt = base.peakAt
    }
  }

  const clipUntil = m.clipped ? now + CLIP_HOLD_MS : base.clipUntil
  const lastSignalAt = m.rmsDb > SILENCE_DB + 1 ? now : base.lastSignalAt

  return { peakDb, peakAt, clipUntil, lastSignalAt }
}

export function channelStatus(track: MeterTrack, now: number): 'signal' | 'no-signal' | 'clip' {
  if (now < track.clipUntil) return 'clip'
  if (now - track.lastSignalAt > NO_SIGNAL_AFTER_MS) return 'no-signal'
  return 'signal'
}
