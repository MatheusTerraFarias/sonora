/** intervalo entre testes de conexão */
export const PROBE_INTERVAL_MS = 30_000
/** depois de uma falha, novo teste mais cedo (uma falha isolada não derruba a conexão) */
export const PROBE_RETRY_MS = 5_000
/** tempo máximo de cada teste */
export const PROBE_TIMEOUT_MS = 5_000

export interface ConnectivityDeps {
  /** true se a internet respondeu; pode lançar (conta como falha) */
  probe(): Promise<boolean>
  /** chamado só quando o estado combinado muda */
  onChange(online: boolean): void
}

/**
 * Conexão combinada: o navegador do operador (navigator.onLine) e um teste real ao YouTube.
 * Offline se qualquer um disser offline — "Wi-Fi ligado mas sem internet" só o teste percebe.
 * O teste precisa falhar duas vezes seguidas para derrubar; um sucesso já basta para voltar.
 */
export class Connectivity {
  private navigatorOnline = true
  private reachable = true
  private failures = 0
  private running = false
  private stopped = true
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private readonly deps: ConnectivityDeps) {}

  get online(): boolean {
    return this.navigatorOnline && this.reachable
  }

  start(): void {
    this.stopped = false
    void this.check()
  }

  stop(): void {
    this.stopped = true
    clearTimeout(this.timer)
  }

  /** informado pelo operador (navigator.onLine e eventos online/offline); retorna o estado combinado */
  setNavigatorOnline(online: boolean): boolean {
    const before = this.online
    this.navigatorOnline = online
    this.notify(before)
    if (!this.stopped) void this.check()
    return this.online
  }

  private notify(before: boolean): void {
    if (this.online === before) return
    try {
      this.deps.onChange(this.online)
    } catch {
      // quem escuta não derruba o monitor
    }
  }

  private async check(): Promise<void> {
    if (this.running || this.stopped) return
    this.running = true
    clearTimeout(this.timer)
    let ok = false
    try {
      ok = await this.deps.probe()
    } catch {
      ok = false
    }
    this.running = false
    if (this.stopped) return
    const before = this.online
    if (ok) {
      this.failures = 0
      this.reachable = true
    } else if (++this.failures >= 2) {
      this.reachable = false
    }
    this.notify(before)
    this.timer = setTimeout(() => void this.check(), ok || !this.reachable ? PROBE_INTERVAL_MS : PROBE_RETRY_MS)
  }
}

/** URL leve do YouTube que responde 204 sem corpo */
export const PROBE_URL = 'https://www.youtube.com/generate_204'

/** teste real: qualquer resposta HTTP do YouTube conta como "tem internet"; nunca lança */
export async function probeYoutube(fetchFn: (url: string, init: RequestInit) => Promise<Response>): Promise<boolean> {
  try {
    const res = await fetchFn(PROBE_URL, { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return res.status > 0
  } catch {
    return false
  }
}
