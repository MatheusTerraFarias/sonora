import { useEffect, useRef, useState } from 'react'
import type { LiveContent } from '../../shared/types'
import {
  embedUrl,
  watchUrl,
  youtubeGate,
  youtubeStatus,
  YOUTUBE_EMBED_REFERRER,
  YOUTUBE_PARTITION,
  type GateState,
  type PlayerSample,
  type YoutubeStatus
} from '../../shared/youtube'
import type { WebviewElement } from '../shared/webview'

type YoutubeContent = Extract<LiveContent, { type: 'youtube' }>

const TICK_MS = 250
const TICK_VISIBLE_MS = 100
const FADE_MS = 300
/** um erro só vira "Vídeo indisponível" para o operador depois de persistir por este tempo */
const ERROR_CONFIRM_MS = 1500
/** página que não carregou (ex.: sem internet): nova tentativa depois de */
const RELOAD_AFTER_FAIL_MS = 10_000

/** Esconde tudo menos o <video>, em tela cheia (sem título, logo, telas de fim ou da página de watch). */
const VIDEO_ONLY_CSS = `
html, body { background: #000 !important; overflow: hidden !important; cursor: none !important; }
body * { visibility: hidden !important; }
ytd-app, ytd-page-manager, ytd-watch-flexy, #columns, #primary, #player, #player-container, #player-container-outer,
#player-container-inner, #movie_player, .html5-video-player, .html5-video-container {
  transform: none !important; contain: none !important; filter: none !important;
}
video {
  visibility: visible !important; position: fixed !important; left: 0 !important; top: 0 !important;
  width: 100vw !important; height: 100vh !important; object-fit: contain !important;
  z-index: 2147483647 !important; background: #000 !important;
}
`

interface Want {
  play: boolean
  volume: number
  seekTo: number | null
}

type Sample = PlayerSample & { found: boolean; duration: number; seeked: boolean }

/**
 * Lê o estado do <video> da página e aplica play/pausa/volume/posição — pela API do player da
 * página (playVideo/pauseVideo/seekTo/mute/setVolume) quando existe, senão no próprio <video>
 * (mexer só no elemento faz a página de watch pausar de novo).
 * Erro: o evento onError do player ou, sem ele, o texto "Erro NNN"/"Error NNN" de dentro da
 * tela de erro do player (nunca do player inteiro, que inclui o título); tela de erro
 * visível sem código é tratada como 150 (incorporação proibida).
 * Mudo durante anúncio e enquanto não há play pedido (o autoplay não vaza som); posição só fora de anúncio.
 */
const tickScript = (want: Want): string => `(() => {
  const want = ${JSON.stringify(want)};
  const p = document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  if (p && !window.__sonoraHooked && typeof p.addEventListener === 'function') {
    try {
      p.addEventListener('onError', (e) => { const c = Number(e && typeof e === 'object' ? e.data : e); if (Number.isFinite(c)) window.__sonoraErr = c; });
      window.__sonoraHooked = true;
    } catch (_) {}
  }
  let errorCode = typeof window.__sonoraErr === 'number' ? window.__sonoraErr : null;
  if (errorCode === null) {
    // só a tela de erro do player (o título do vídeo pode conter "Error 404"); no embed ela
    // fica fora de #movie_player, por isso a busca é no documento, mas só nesses seletores
    const screens = [...document.querySelectorAll('.ytp-error, yt-player-error-message-renderer, yt-interstitial-view-model, [class*="ErrorScreen"]')]
      .filter((el) => el.getClientRects().length > 0);
    if (screens.length > 0) {
      const m = /(?:Erro|Error)\\s+(\\d{3})\\b/.exec(screens.map((el) => el.textContent || '').join(' '));
      errorCode = m ? Number(m[1]) : 150;
    }
  }
  const api = !!(p && typeof p.playVideo === 'function' && typeof p.getPlayerState === 'function');
  const state = api ? p.getPlayerState() : null;
  const v = document.querySelector('video');
  const ad = !!(p && p.classList && p.classList.contains('ad-showing'));
  try {
    const muted = ad || !want.play || want.volume <= 0;
    if (api && typeof p.isMuted === 'function') {
      if (muted && !p.isMuted()) p.mute();
      if (!muted && p.isMuted()) p.unMute();
      if (!ad && typeof p.setVolume === 'function' && Math.abs(p.getVolume() - want.volume * 100) > 1) p.setVolume(Math.round(want.volume * 100));
    } else if (v) {
      if (v.muted !== muted) v.muted = muted;
      if (!ad && Math.abs(v.volume - want.volume) > 0.01) v.volume = Math.min(1, Math.max(0, want.volume));
    }
    if (want.play) {
      if (errorCode === null) {
        if (api) { if (state !== 1 && state !== 3 && state !== 0) p.playVideo(); }
        else if (v && v.paused && !v.ended) v.play().catch(() => {});
      }
    } else if (api) { if (state === 1 || state === 3) p.pauseVideo(); }
    else if (v && !v.paused) v.pause();
  } catch (_) {}
  if (!v) return { found: false, currentTime: 0, paused: true, adShowing: false, errorCode, duration: 0, seeked: false };
  let seeked = false;
  if (want.seekTo !== null && !ad && v.readyState > 0) {
    try { if (api && typeof p.seekTo === 'function') p.seekTo(want.seekTo, true); else v.currentTime = want.seekTo; seeked = true; } catch (_) {}
  }
  return { found: true, currentTime: v.currentTime, paused: v.paused, adShowing: ad, errorCode, duration: v.duration, seeked };
})()`

/**
 * Player do YouTube no telão. Fica invisível (o telão mantém o que estava antes) até o vídeo
 * tocar de verdade, sem anúncio — o portão (`youtubeGate`) é checado a cada 250 ms.
 * Vídeo que não permite incorporar: carrega a página de watch na mesma webview, só com o vídeo.
 * Nunca interativo: sem controles, sem cursor, sem cliques.
 */
export function YouTubePlayer({ content }: { content: YoutubeContent }): JSX.Element {
  const { videoId, playing, volume, position, seek } = content
  const ref = useRef<WebviewElement>(null)
  const [mode, setMode] = useState<'embed' | 'watch'>('embed')
  const [gate, setGate] = useState<GateState>('hidden')
  const gateRef = useRef<GateState>('hidden')
  const ready = useRef(false)
  /** a página principal da webview não carregou (sem rede, DNS…) */
  const failed = useRef(false)
  const want = useRef<Want>({ play: playing, volume, seekTo: null })

  want.current.play = playing
  want.current.volume = volume
  useEffect(() => {
    if (seek !== undefined) want.current.seekTo = position
  }, [seek, position])

  // a cada (re)carga da página: CSS que deixa só o vídeo
  useEffect(() => {
    const wv = ref.current
    if (!wv) return
    ready.current = false
    failed.current = false
    gateRef.current = 'hidden'
    setGate('hidden')
    let retry: ReturnType<typeof setTimeout> | undefined
    const onReady = (): void => {
      ready.current = true
      void wv.insertCSS(VIDEO_ONLY_CSS).catch(() => undefined)
    }
    const onFinish = (): void => {
      failed.current = false
    }
    // -3 = carregamento cancelado (troca de página): não é falha
    const onFail = (e: Event): void => {
      const ev = e as Event & { errorCode?: number; isMainFrame?: boolean }
      if (ev.isMainFrame === false || ev.errorCode === -3) return
      failed.current = true
      clearTimeout(retry)
      retry = setTimeout(() => {
        try {
          wv.reload()
        } catch {
          // webview já desmontada
        }
      }, RELOAD_AFTER_FAIL_MS)
    }
    // (did-start-loading não serve para "desarmar": dispara também com iframes de anúncio da página)
    wv.addEventListener('dom-ready', onReady)
    wv.addEventListener('did-finish-load', onFinish)
    wv.addEventListener('did-fail-load', onFail)
    return () => {
      clearTimeout(retry)
      wv.removeEventListener('dom-ready', onReady)
      wv.removeEventListener('did-finish-load', onFinish)
      wv.removeEventListener('did-fail-load', onFail)
    }
  }, [mode])

  // portão + comandos + progresso: a cada 250 ms escondido, 100 ms visível (anúncio no meio some rápido).
  // O status vai ao operador junto com o progresso (~4 Hz), também enquanto a página carrega.
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastReport = 0
    let errorSince: number | null = null
    const last = { position: 0, duration: 0 }
    const schedule = (): void => {
      if (!stopped) timer = setTimeout(tick, gateRef.current === 'visible' ? TICK_VISIBLE_MS : TICK_MS)
    }
    /** esconder é instantâneo: sem esperar o React nem a transição */
    const hideNow = (): void => {
      const el = ref.current
      if (el) {
        el.style.transition = 'none'
        el.style.opacity = '0'
      }
    }
    /** erro só depois de persistir: uma tela de erro passageira não assusta o operador */
    const report = (raw: YoutubeStatus): void => {
      const now = performance.now()
      if (raw === 'error') errorSince ??= now
      else errorSince = null
      const status: YoutubeStatus = raw === 'error' && now - (errorSince ?? now) < ERROR_CONFIRM_MS ? 'loading' : raw
      if (now - lastReport < TICK_MS) return
      lastReport = now
      window.sonora.live.reportProgress({ key: videoId, position: last.position, duration: last.duration, status })
    }
    const tick = (): void => {
      const wv = ref.current
      if (!wv || !ready.current) {
        report(failed.current ? 'error' : 'loading')
        return schedule()
      }
      wv.executeJavaScript(tickScript(want.current))
        .then((raw) => {
          const s = raw as Sample | null
          if (stopped) return
          if (!s) {
            report(failed.current ? 'error' : 'loading')
            return
          }
          if (s.seeked) want.current.seekTo = null
          const sample: PlayerSample = {
            currentTime: s.currentTime,
            paused: s.paused,
            adShowing: s.adShowing,
            errorCode: s.errorCode
          }
          const next = s.found || sample.errorCode !== null ? youtubeGate(sample, gateRef.current, mode) : 'hidden'
          if (next !== 'visible') hideNow()
          if (next === 'fallback') {
            ready.current = false
            gateRef.current = 'hidden'
            setGate('hidden')
            setMode('watch')
            report('loading')
            return
          }
          if (next !== gateRef.current) {
            gateRef.current = next
            setGate(next)
          }
          if (s.found && !s.adShowing && Number.isFinite(s.duration) && s.duration > 0) {
            last.position = s.currentTime
            last.duration = s.duration
          }
          report(failed.current && !s.found ? 'error' : youtubeStatus({ ...sample, found: s.found }, next, mode))
        })
        .catch(() => report(failed.current ? 'error' : 'loading'))
        .finally(schedule)
    }
    schedule()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [mode, videoId])

  return (
    <webview
      ref={ref as React.Ref<HTMLWebViewElement>}
      src={mode === 'embed' ? embedUrl(videoId) : watchUrl(videoId)}
      partition={YOUTUBE_PARTITION}
      httpreferrer={YOUTUBE_EMBED_REFERRER}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        pointerEvents: 'none',
        opacity: gate === 'visible' ? 1 : 0,
        // só o aparecer tem fade; sumir (anúncio) é imediato
        transition: gate === 'visible' ? `opacity ${FADE_MS}ms ease` : 'none'
      }}
    />
  )
}
