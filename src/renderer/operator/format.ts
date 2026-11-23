import { strings } from '../shared/strings'

export const todayIso = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "2026-11-23" → "23/11/2026" */
export const formatDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}


/** "2026-11-23" → "domingo" (dia da semana local) */
export const weekday = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return ''
  return strings.common.weekdays[new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getDay()]
}

/** primeira linha não vazia de um texto */
export const firstLine = (text: string): string => text.split('\n').find((l) => l.trim())?.trim() ?? ''

/** "2026-11-23" → { day: '23', month: 'nov' } */
export const dayMonth = (iso: string): { day: string; month: string } => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return { day: '', month: '' }
  return { day: String(Number(m[3])), month: strings.common.months[Number(m[2]) - 1] ?? '' }
}
