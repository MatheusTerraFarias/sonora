import { useCallback, useEffect, useRef, useState } from 'react'
import type { ServiceItemData } from '../../../shared/types'
import type { YoutubeFavorite } from '../../../main/repos/favorites'
import { parseVideoId, watchUrl, YOUTUBE_PARTITION } from '../../../shared/youtube'
import { strings } from '../../shared/strings'
import type { WebviewElement } from '../../shared/webview'
import { AddToServiceButton } from '../components/AddToServiceButton'
import { ErrorBanner, useSafe } from '../components/useSafe'
import { useOperatorStore } from '../store'
import './YouTube.css'

const HOME = 'https://www.youtube.com/'

type Lookup =
  | { status: 'idle' }
  | { status: 'loading'; videoId: string }
  | { status: 'ok'; videoId: string; title: string; author: string; thumbnail: string }
  | { status: 'notfound'; videoId: string }

/** "Nome do vídeo - YouTube" → "Nome do vídeo" */
const cleanTitle = (t: string): string => t.replace(/\s*-\s*YouTube\s*$/i, '').trim()

/** Navegador do YouTube (sessão persist:youtube) com "Adicionar ao culto", "Favoritar" e a lista de favoritos. */
export function YouTube(): JSX.Element {
  const online = useOperatorStore((s) => s.onlineStatus)
  const webviewRef = useRef<WebviewElement>(null)
  const [url, setUrl] = useState(HOME)
  const [pageTitle, setPageTitle] = useState('')
  const [nav, setNav] = useState({ back: false, forward: false })
  const [lookup, setLookup] = useState<Lookup>({ status: 'idle' })
  const [favorites, setFavorites] = useState<YoutubeFavorite[]>([])
  const { error, run } = useSafe()
  const videoId = parseVideoId(url)

  // URL e título atuais da webview (o YouTube navega por pushState: did-navigate-in-page)
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return
    const sync = (): void => {
      try {
        setUrl(wv.getURL())
        setPageTitle(cleanTitle(wv.getTitle()))
        setNav({ back: wv.canGoBack(), forward: wv.canGoForward() })
      } catch {
        // ainda não anexada
      }
    }
    const onInPage = (e: Event): void => {
      if ((e as Event & { isMainFrame?: boolean }).isMainFrame !== false) sync()
    }
    wv.addEventListener('did-navigate', sync)
    wv.addEventListener('did-navigate-in-page', onInPage)
    wv.addEventListener('page-title-updated', sync)
    wv.addEventListener('dom-ready', sync)
    return () => {
      wv.removeEventListener('did-navigate', sync)
      wv.removeEventListener('did-navigate-in-page', onInPage)
      wv.removeEventListener('page-title-updated', sync)
      wv.removeEventListener('dom-ready', sync)
    }
  }, [])

  // título/miniatura/existência via oEmbed (buscado no main)
  useEffect(() => {
    if (!videoId || !online) {
      setLookup({ status: 'idle' })
      return
    }
    let cancelled = false
    setLookup({ status: 'loading', videoId })
    void run(() => window.sonora.youtube.oembed(videoId)).then((r) => {
      if (cancelled) return
      if (!r.ok) setLookup({ status: 'idle' })
      else if (!r.value) setLookup({ status: 'notfound', videoId })
      else setLookup({ status: 'ok', videoId, ...r.value })
    })
    return () => {
      cancelled = true
    }
  }, [videoId, online, run])

  const reloadFavorites = useCallback(async (): Promise<void> => {
    const r = await run(() => window.sonora.favorites.list())
    if (r.ok) setFavorites(r.value)
  }, [run])

  useEffect(() => {
    void reloadFavorites()
  }, [reloadFavorites])

  const current = lookup.status === 'ok' && lookup.videoId === videoId ? lookup : null
  const title = current ? current.title || pageTitle || strings.youtube.untitled : ''
  const itemData: ServiceItemData | null = current
    ? { kind: 'youtube', videoId: current.videoId, title, thumbnail: current.thumbnail }
    : null
  const isFavorite = !!videoId && favorites.some((f) => f.videoId === videoId)

  const favorite = async (): Promise<void> => {
    if (!current) return
    const r = await run(() =>
      window.sonora.favorites.add({ videoId: current.videoId, title, channel: current.author, thumbnail: current.thumbnail })
    )
    if (r.ok) await reloadFavorites()
  }

  const removeFavorite = async (id: string): Promise<void> => {
    const r = await run(() => window.sonora.favorites.remove(id))
    if (r.ok) await reloadFavorites()
  }

  const open = (target: string): void => {
    void webviewRef.current?.loadURL(target).catch(() => undefined)
  }

  return (
    <section className="youtube">
      <div className="youtube__main">
        <div className="toolbar youtube__toolbar">
          <button type="button" className="btn" disabled={!nav.back} onClick={() => webviewRef.current?.goBack()}>
            {strings.youtube.back}
          </button>
          <button type="button" className="btn" disabled={!nav.forward} onClick={() => webviewRef.current?.goForward()}>
            {strings.youtube.forward}
          </button>
          <button type="button" className="btn" onClick={() => open(HOME)}>
            {strings.youtube.home}
          </button>
          <AddToServiceButton data={online ? itemData : null} />
          <button type="button" className="btn" disabled={!current || isFavorite} onClick={() => void favorite()}>
            {isFavorite ? strings.youtube.favorited : strings.youtube.favorite}
          </button>
          <ErrorBanner show={error} />
        </div>
        <p className="hint youtube__status" aria-live="polite">
          {!online
            ? strings.youtube.offline
            : !videoId
              ? strings.youtube.noVideo
              : lookup.status === 'loading'
                ? strings.youtube.checking
                : lookup.status === 'notfound'
                  ? strings.youtube.notFound
                  : title}
        </p>
        <webview
          ref={webviewRef as React.Ref<HTMLWebViewElement>}
          className="youtube__webview"
          src={HOME}
          partition={YOUTUBE_PARTITION}
          aria-label={strings.youtube.browserLabel}
        />
      </div>
      <aside className="youtube__favorites">
        <h2 className="pane-title">{strings.youtube.favorites}</h2>
        {favorites.length === 0 && <p className="hint">{strings.youtube.noFavorites}</p>}
        <ul className="youtube__fav-list">
          {favorites.map((f) => (
            <li key={f.videoId} className="youtube__fav">
              {f.thumbnail ? <img className="youtube__thumb" src={f.thumbnail} alt="" draggable={false} /> : null}
              <span className="youtube__fav-title" title={f.title}>
                {f.title || strings.youtube.untitled}
              </span>
              {f.channel ? <small className="hint">{f.channel}</small> : null}
              <div className="youtube__fav-actions">
                <button type="button" className="btn" onClick={() => open(watchUrl(f.videoId))}>
                  {strings.youtube.open}
                </button>
                <AddToServiceButton
                  data={{ kind: 'youtube', videoId: f.videoId, title: f.title || strings.youtube.untitled, thumbnail: f.thumbnail }}
                />
                <button type="button" className="btn btn--danger" onClick={() => void removeFavorite(f.videoId)}>
                  {strings.youtube.removeFavorite}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  )
}
