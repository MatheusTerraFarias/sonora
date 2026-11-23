import { useCallback, useState } from 'react'
import { strings } from '../../shared/strings'

export type SafeResult<T> = { ok: true; value: T } | { ok: false; message: string }

/** Executa chamadas à API capturando falhas; `error` alimenta o ErrorBanner. */
export function useSafe(): {
  error: boolean
  clearError: () => void
  run: <T>(fn: () => Promise<T>) => Promise<SafeResult<T>>
} {
  const [error, setError] = useState(false)
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<SafeResult<T>> => {
    try {
      const value = await fn()
      setError(false)
      return { ok: true, value }
    } catch (err) {
      setError(true)
      return { ok: false, message: err instanceof Error ? err.message : String(err) }
    }
  }, [])
  const clearError = useCallback(() => setError(false), [])
  return { error, clearError, run }
}

export function ErrorBanner({ show }: { show: boolean }): JSX.Element | null {
  return show ? (
    <p className="hint hint--error" role="alert">
      {strings.common.error}
    </p>
  ) : null
}
