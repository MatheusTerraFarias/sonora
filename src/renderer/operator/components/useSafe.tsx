import { useCallback, useState } from 'react'

export type SafeResult<T> = { ok: true; value: T } | { ok: false; message: string }

/** Executa chamadas à API capturando falhas; `error` alimenta um <Notice tone="error">. */
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
