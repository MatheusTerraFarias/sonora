import { app, net, shell, type WebContents } from 'electron'
import { guestMayNavigate, isYoutubeUrl, parseVideoId, thumbnailUrl, YOUTUBE_PARTITION } from '../../shared/youtube'

/** abre no navegador do sistema, só links http(s) */
export function openExternalSafe(url: string): void {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return
  }
  if (u.protocol === 'http:' || u.protocol === 'https:') void shell.openExternal(u.toString()).catch(() => undefined)
}

/**
 * Endurece toda <webview>: força a partição do YouTube, remove preload, sem Node,
 * com isolamento; só carrega youtube.com; sem pop-ups. `opensLinks(embedder)` diz se
 * a janela que hospeda a webview pode abrir links no navegador (só o operador; o telão nunca).
 */
export function hardenWebviews(opensLinks: (embedder: WebContents) => boolean): void {
  app.on('web-contents-created', (_e, contents) => {
    if (contents.getType() === 'webview') return
    contents.on('will-attach-webview', (event, webPreferences, params) => {
      if (!isYoutubeUrl(params.src)) {
        event.preventDefault()
        return
      }
      delete webPreferences.preload
      webPreferences.nodeIntegration = false
      webPreferences.nodeIntegrationInSubFrames = false
      webPreferences.contextIsolation = true
      webPreferences.sandbox = true
      // a página do YouTube nunca hospeda outra webview
      webPreferences.webviewTag = false
      webPreferences.webSecurity = true
      webPreferences.allowRunningInsecureContent = false
      webPreferences.autoplayPolicy = 'no-user-gesture-required'
      params.partition = YOUTUBE_PARTITION
      delete (params as Record<string, string>).allowpopups
    })
    contents.on('did-attach-webview', (_event, guest) => {
      const external = opensLinks(contents)
      guest.setWindowOpenHandler(({ url }) => {
        if (external) openExternalSafe(url)
        return { action: 'deny' }
      })
      guest.on('will-navigate', (event) => {
        if (guestMayNavigate(event.url)) return
        event.preventDefault()
        if (external) openExternalSafe(event.url)
      })
      // redirecionamentos HTTP do quadro principal seguem a mesma regra (iframes podem ser de outra origem)
      guest.on('will-redirect', (event) => {
        if (!event.isMainFrame || guestMayNavigate(event.url)) return
        event.preventDefault()
        if (external) openExternalSafe(event.url)
      })
    })
  })
}

export interface OembedInfo {
  title: string
  author: string
  thumbnail: string
}

/**
 * Título, canal e miniatura via oEmbed; null se o vídeo não existe.
 * Vídeos que não permitem incorporação respondem 401/403: existem, mas sem metadados.
 * Lança em falha de rede (o operador mostra o erro).
 */
export async function fetchOembed(videoId: string): Promise<OembedInfo | null> {
  const id = parseVideoId(videoId)
  if (!id || id !== videoId) return null
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`
  const res = await net.fetch(url)
  if (res.status === 401 || res.status === 403) return { title: '', author: '', thumbnail: thumbnailUrl(id) }
  if (!res.ok) return null
  const j = (await res.json()) as { title?: unknown; author_name?: unknown; thumbnail_url?: unknown }
  const thumb = typeof j.thumbnail_url === 'string' && j.thumbnail_url.startsWith('https://i.ytimg.com/') ? j.thumbnail_url : thumbnailUrl(id)
  return {
    title: typeof j.title === 'string' ? j.title : '',
    author: typeof j.author_name === 'string' ? j.author_name : '',
    thumbnail: thumb
  }
}
