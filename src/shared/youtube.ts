const ID_RE = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])

/** Extrai o id do vídeo de um link do YouTube (watch, youtu.be, embed, shorts) ou de um id puro; null se não houver. */
export function parseVideoId(urlOrId: string): string | null {
  const text = urlOrId.trim()
  if (!text) return null
  if (ID_RE.test(text)) return text
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  let candidate: string | null = null
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null
  } else if (HOSTS.has(host)) {
    const [, first, second] = url.pathname.split('/')
    if (first === 'watch') candidate = url.searchParams.get('v')
    else if (first === 'embed' || first === 'shorts' || first === 'v' || first === 'live') candidate = second ?? null
  }
  return candidate && ID_RE.test(candidate) ? candidate : null
}

/** partição de sessão compartilhada pelo navegador do operador e pelo player do telão (login do Premium fica salvo) */
export const YOUTUBE_PARTITION = 'persist:youtube'

/** origens que uma <webview> pode carregar */
export const YOUTUBE_ORIGINS = ['https://www.youtube.com', 'https://youtube.com', 'https://m.youtube.com'] as const

/** true se `url` é https em www.youtube.com, youtube.com ou m.youtube.com */
export function isYoutubeUrl(url: string): boolean {
  try {
    return (YOUTUBE_ORIGINS as readonly string[]).includes(new URL(url).origin)
  } catch {
    return false
  }
}

export const embedUrl = (id: string): string =>
  `https://www.youtube.com/embed/${id}?autoplay=1&controls=0&rel=0&modestbranding=1&enablejsapi=1`
/**
 * O YouTube recusa embeds sem HTTP Referer (erro 153). Apps identificam-se com
 * `https://<app id>` (appId do electron-builder.yml).
 */
export const YOUTUBE_EMBED_REFERRER = 'https://br.app.sonora/'
export const watchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`
export const thumbnailUrl = (id: string): string => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

/** erros em que o embed é recusado mas a página de watch funciona */
const EMBED_REFUSED = new Set([101, 150, 153])

export type GateState = 'hidden' | 'visible' | 'fallback'

export interface PlayerSample {
  currentTime: number
  paused: boolean
  /** o player tem a classe `ad-showing` */
  adShowing: boolean
  /** código de erro do player (101/150 = incorporação proibida, 153 = embed recusado); null sem erro */
  errorCode: number | null
}

/**
 * Portão do telão: a webview só aparece com o conteúdo tocando de verdade (currentTime > 0,
 * sem pausa, sem anúncio). Uma pausa depois de visível mantém o quadro, para o telão não voltar
 * ao slide anterior quando o operador pausa. Erros 101/150/153 pedem a página de watch.
 */
export function youtubeGate(sample: PlayerSample, prev: GateState = 'hidden'): GateState {
  if (sample.errorCode !== null && EMBED_REFUSED.has(sample.errorCode)) return 'fallback'
  if (sample.errorCode !== null || sample.adShowing || !(sample.currentTime > 0)) return 'hidden'
  if (!sample.paused) return 'visible'
  return prev === 'visible' ? 'visible' : 'hidden'
}
