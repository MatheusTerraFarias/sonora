import { useEffect } from 'react'
import { shortcutAction, type ShortcutAction } from './shortcuts'

const isEditable = (t: EventTarget | null): boolean => {
  if (!(t instanceof HTMLElement)) return false
  return t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
}

/** Atalhos da operação (ver `shortcutAction`); ignorados quando o foco está num campo. */
export function useShortcuts(onAction: (a: ShortcutAction) => void): void {
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      const a = shortcutAction({
        key: e.key,
        targetIsEditable: isEditable(e.target),
        ctrlKey: e.ctrlKey,
        altKey: e.altKey,
        metaKey: e.metaKey
      })
      if (!a) return
      e.preventDefault()
      if (!e.repeat) onAction(a)
    }
    // Espaço sobre um botão focado dispararia o clique no keyup
    const up = (e: KeyboardEvent): void => {
      if (e.key === ' ' && !isEditable(e.target)) e.preventDefault()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [onAction])
}
