/** tempo que o telão pode ficar sem responder antes de ser derrubado e recarregado */
export const HANG_GRACE_MS = 5_000
/** espera antes de recarregar (junta "derrubado" + "processo caiu" numa recarga só) */
export const RELOAD_DELAY_MS = 250

export interface RecoverableContents {
  on(event: 'render-process-gone', cb: (event: unknown, details: { reason: string }) => void): unknown
  on(event: 'unresponsive' | 'responsive', cb: () => void): unknown
  reload(): void
  forcefullyCrashRenderer(): void
  isDestroyed(): boolean
}

/**
 * O telão nunca fica congelado ou vazio para sempre: processo que caiu é recarregado; processo
 * travado por mais de HANG_GRACE_MS é derrubado e recarregado. A janela continua no mesmo lugar
 * (não é recriada nem movida), então nunca vai parar no monitor do operador. Ao recarregar, o
 * telão pede o estado ao vivo (live.get) e volta a mostrar o que estava no ar.
 * `onRecover` é avisado a cada recuperação (para registro).
 */
export function attachCrashRecovery(wc: RecoverableContents, onRecover?: (reason: string) => void): void {
  let pending = false
  let hang: ReturnType<typeof setTimeout> | undefined
  const scheduleReload = (): void => {
    if (pending || wc.isDestroyed()) return
    pending = true
    setTimeout(() => {
      pending = false
      if (!wc.isDestroyed()) wc.reload()
    }, RELOAD_DELAY_MS)
  }
  wc.on('render-process-gone', (_e, details) => {
    clearTimeout(hang)
    if (wc.isDestroyed() || details?.reason === 'clean-exit') return
    onRecover?.(details?.reason ?? 'unknown')
    scheduleReload()
  })
  wc.on('unresponsive', () => {
    clearTimeout(hang)
    hang = setTimeout(() => {
      if (wc.isDestroyed()) return
      onRecover?.('unresponsive')
      try {
        wc.forcefullyCrashRenderer()
      } catch {
        // já caiu
      }
      scheduleReload()
    }, HANG_GRACE_MS)
  })
  wc.on('responsive', () => clearTimeout(hang))
}
