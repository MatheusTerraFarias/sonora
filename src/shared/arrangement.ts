import type { ID } from './types'

/** Move o elemento de `from` para `to` (índices do array original). */
export function moveInArrangement(arr: ID[], from: number, to: number): ID[] {
  if (from === to || from < 0 || from >= arr.length || to < 0 || to >= arr.length) return arr.slice()
  const out = arr.slice()
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item)
  return out
}

export function removeFromArrangement(arr: ID[], index: number): ID[] {
  return arr.filter((_, i) => i !== index)
}

export function appendToArrangement(arr: ID[], partId: ID): ID[] {
  return [...arr, partId]
}

/** "louvor, adoração ,," -> ["louvor", "adoração"] (sem repetições) */
export function parseTags(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of text.split(',')) {
    const t = raw.trim()
    const k = t.toLowerCase()
    if (t && !seen.has(k)) {
      seen.add(k)
      out.push(t)
    }
  }
  return out
}
