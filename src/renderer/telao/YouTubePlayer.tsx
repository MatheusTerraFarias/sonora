import { useEffect, useRef, useState } from 'react'
import type { LiveContent } from '../../shared/types'
import {
  embedUrl,
  watchUrl,
  youtubeGate,
  YOUTUBE_EMBED_REFERRER,
  YOUTUBE_PARTITION,
  type GateState,
  type PlayerSample
} from '../../shared/youtube'
import type { WebviewElement } from '../shared/webview'

type YoutubeContent = Extract<LiveContent, { type: 'youtube' }>

const TICK_MS = 250
const TICK_VISIBLE_MS = 100
const FADE_MS = 300

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
    gateRef.current = 'hidden'
    setGate('hidden')
    const onReady = (): void => {
      ready.current = true
      void wv.insertCSS(VIDEO_ONLY_CSS).catch(() => undefined)
    }
    // (did-start-loading não serve para "desarmar": dispara também com iframes de anúncio da página)
    wv.addEventListener('dom-ready', onReady)
    return () => {
      wv.removeEventListener('dom-ready', onReady)
    }
  }, [mode])

  // portão + comandos + progresso: a cada 250 ms escondido, 100 ms visível (anúncio no meio some rápido)
  useEffect(() => {
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let lastReport = 0
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
    const tick = (): void => {
      const wv = ref.current
      if (!wv || !ready.current) return schedule()
      wv.executeJavaScript(tickScript(want.current))
        .then((raw) => {
          const s = raw as Sample | null
          if (!s || stopped) return
          if (s.seeked) want.current.seekTo = null
          const sample: PlayerSample = {
            currentTime: s.currentTime,
            paused: s.paused,
            adShowing: s.adShowing,
            // na página de watch o erro de incorporação não se aplica
            errorCode: mode === 'watch' ? null : s.errorCode
          }
          const next = s.found || sample.errorCode !== null ? youtubeGate(sample, gateRef.current) : 'hidden'
          if (next !== 'visible') hideNow()
          if (next === 'fallback') {
            ready.current = false
            gateRef.current = 'hidden'
            setGate('hidden')
            setMode('watch')
            return
          }
          if (next !== gateRef.current) {
            gateRef.current = next
            setGate(next)
          }
          const now = performance.now()
          if (s.found && !s.adShowing && Number.isFinite(s.duration) && s.duration > 0 && now - lastReport >= TICK_MS) {
            lastReport = now
            window.sonora.live.reportProgress({ key: videoId, position: s.currentTime, duration: s.duration })
          }
        })
        .catch(() => undefined)
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
