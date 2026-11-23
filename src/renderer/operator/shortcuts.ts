import type { Overlay } from '../../shared/types'

export type ShortcutAction = 'next' | 'prev' | Overlay

export interface ShortcutEvent {
  key: string
  targetIsEditable: boolean
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
}

/** Tecla → ação da operação; null quando a tecla não deve ser tratada. */
export function shortcutAction(e: ShortcutEvent): ShortcutAction | null {
  if (e.targetIsEditable || e.ctrlKey || e.altKey || e.metaKey) return null
  switch (e.key) {
    case 'ArrowRight':
    case ' ':
    case 'PageDown':
      return 'next'
    case 'ArrowLeft':
    case 'PageUp':
      return 'prev'
    case 'b':
    case 'B':
      return 'black'
    case 'c':
    case 'C':
      return 'clear'
    case 'l':
    case 'L':
      return 'logo'
    case 'Escape':
      return 'none'
    default:
      return null
  }
}
