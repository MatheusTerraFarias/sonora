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
