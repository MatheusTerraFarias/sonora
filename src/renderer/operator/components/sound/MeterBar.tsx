import { forwardRef, useImperativeHandle, useRef } from 'react'
import { SILENCE_DB, levelState } from '../../../../shared/meter'
import { strings } from '../../../shared/strings'
import type { InputReading } from '../../sound/meterEngine'

/** idle = motor não está lendo; no-input = canal sem entrada (ou fora do dispositivo) */
export type MeterValue = InputReading | 'no-input' | null

export interface MeterBarHandle {
  set(value: MeterValue): void
}

type Look = 'idle' | 'no-input' | 'no-signal' | 'clip' | 'hot' | 'ok' | 'silent'

const L = strings.sound.level

/** queda máxima da barra por segundo (fração da escala): a escala inteira em ~0,6 s */
const RELEASE_PER_S = 1.6

/** 0..1 na escala SILENCE_DB..0 dB */
export function dbToFraction(db: number): number {
  if (!Number.isFinite(db)) return 0
  return Math.min(1, Math.max(0, (db - SILENCE_DB) / -SILENCE_DB))
}

/** Estado visual + texto (sempre por extenso, nunca só cor). */
export function describe(value: MeterValue): { look: Look; text: string; level: number; peak: number } {
  if (value === null) return { look: 'idle', text: L.idle, level: 0, peak: 0 }
  if (value === 'no-input') return { look: 'no-input', text: L.noInput, level: 0, peak: 0 }
  const level = dbToFraction(value.rmsDb)
  const peak = dbToFraction(value.peakDb)
  if (value.status === 'clip') return { look: 'clip', text: L.clip, level, peak }
  if (value.status === 'no-signal') return { look: 'no-signal', text: L.noSignal, level, peak }
  return { look: levelState(value.rmsDb), text: L.db(Math.round(value.rmsDb)), level, peak }
}

/**
 * Medidor horizontal (SILENCE_DB a 0 dB) com marca de pico. Não re-renderiza por quadro:
 * o dono chama `set()` (num requestAnimationFrame) e a barra escreve direto no DOM,
 * só quando algo mudou.
 */
export const MeterBar = forwardRef<MeterBarHandle, { label: string }>(function MeterBar({ label }, ref) {
  const rootRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLDivElement>(null)
  const peakRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLSpanElement>(null)
  const lastAt = useRef(0)
  const last = useRef<{ look: Look | ''; text: string; level: number; peak: number }>({ look: '', text: '', level: -1, peak: -1 })

  useImperativeHandle(
    ref,
    () => ({
      set(value) {
        const root = rootRef.current
        if (!root) return
        const d = describe(value)
        const prev = last.current
        // balística só de vista: sobe na hora, desce no máximo RELEASE_PER_S (sem tremedeira)
        const now = performance.now()
        const dt = Math.min(0.25, Math.max(0, (now - lastAt.current) / 1000))
        lastAt.current = now
        const shown = Math.max(d.level, prev.level - RELEASE_PER_S * dt)
        // passos de 0,5% bastam para a vista; evita escrever no DOM à toa
        const level = d.look === 'idle' || d.look === 'no-input' ? 0 : Math.round(shown * 200) / 200
        const peak = Math.round(d.peak * 200) / 200
        if (d.look !== prev.look) root.dataset.look = d.look
        if (d.text !== prev.text && textRef.current) textRef.current.textContent = d.text
        if (level !== prev.level && fillRef.current) fillRef.current.style.transform = `scaleX(${level})`
        if (peak !== prev.peak && peakRef.current) {
          peakRef.current.style.left = `${peak * 100}%`
          peakRef.current.style.opacity = peak > 0 ? '1' : '0'
        }
        last.current = { look: d.look, text: d.text, level, peak }
      }
    }),
    []
  )

  return (
    <div ref={rootRef} className="meter" data-look="idle" role="group" aria-label={label}>
      <div className="meter__track" aria-hidden="true">
        <div className="meter__segments">
          <div ref={fillRef} className="meter__fill" style={{ transform: 'scaleX(0)' }} />
        </div>
        <div ref={peakRef} className="meter__peak" style={{ left: '0%', opacity: 0 }} />
      </div>
      <span ref={textRef} className="meter__value tnum" aria-live="off">
        {L.idle}
      </span>
    </div>
  )
})
