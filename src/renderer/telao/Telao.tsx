import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fitFontSizeWithFloor } from '../../shared/fitText'
import type { LiveContent, LiveState, Slide, TextStyle } from '../../shared/types'
import { Background, mediaUrl } from './Background'

const FADE_MS = 300
const SAFE = 0.9
const LINE_HEIGHT = 1.25

type MediaContent = Extract<LiveContent, { type: 'media' }>

const fadeStyle = (visible: boolean): React.CSSProperties => ({
  opacity: visible ? 1 : 0,
  transition: `opacity ${FADE_MS}ms ease`
})

const textBase = (style: TextStyle): React.CSSProperties => ({
  fontFamily: `'${style.fontFamily}', 'Sora', system-ui, sans-serif`,
  textAlign: style.align,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  lineHeight: LINE_HEIGHT,
  fontWeight: 600
})

/** Texto de um slide ajustado à área segura (90%). */
function SlideText({ slide, style }: { slide: Slide; style: TextStyle }): JSX.Element {
  const measureRef = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(style.minFontPx)
  const [ready, setReady] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const onResize = (): void => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    let cancelled = false
    const fit = (): void => {
      const el = measureRef.current
      if (!el || cancelled) return
      const box = { width: window.innerWidth * SAFE, height: window.innerHeight * SAFE }
      el.style.width = `${box.width}px`
      const size = fitFontSizeWithFloor(
        (p) => {
          el.style.fontSize = `${p}px`
          return { width: el.scrollWidth, height: el.scrollHeight }
        },
        box,
        style.minFontPx,
        style.maxFontPx
      )
      setPx(size)
      setReady(true)
    }
    void document.fonts.ready.then(fit, fit)
    return () => {
      cancelled = true
    }
  }, [slide.text, style.fontFamily, style.minFontPx, style.maxFontPx, tick])

  const base = textBase(style)
  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        style={{ ...base, position: 'absolute', left: -99999, top: 0, visibility: 'hidden' }}
      >
        {slide.text}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'safe center',
          justifyContent: 'center'
        }}
      >
        <div
          style={{
            ...base,
            width: `${SAFE * 100}%`,
            fontSize: px,
            color: style.color,
            textShadow: style.shadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
            opacity: ready ? 1 : 0
          }}
        >
          {slide.text}
        </div>
      </div>
      {slide.title ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: '2.5%',
            textAlign: 'center',
            fontFamily: base.fontFamily,
            fontSize: Math.max(16, Math.round(window.innerHeight * 0.03)),
            color: style.color,
            opacity: 0.8,
            textShadow: style.shadow ? '0 1px 4px rgba(0,0,0,0.8)' : 'none'
          }}
        >
          {slide.title}
        </div>
      ) : null}
    </>
  )
}

interface Layer {
  key: number
  slide: Slide
  leaving: boolean
}

/** Mantém o slide anterior em fade-out enquanto o novo entra em fade-in. */
function SlideLayers({ slide, style }: { slide: Slide | null; style: TextStyle }): JSX.Element {
  const [layers, setLayers] = useState<Layer[]>([])
  const counter = useRef(0)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    setLayers((prev) => {
      const old = prev.map((l) => ({ ...l, leaving: true }))
      return slide ? [...old, { key: ++counter.current, slide, leaving: false }] : old
    })
    setShown(false)
    const raf = requestAnimationFrame(() => setShown(true))
    const t = setTimeout(() => setLayers((p) => p.filter((l) => !l.leaving)), FADE_MS + 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
    // o objeto muda a cada broadcast; só a troca real de texto/rodapé dispara o fade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide?.text, slide?.title, slide?.label])

  return (
    <>
      {layers.map((l) => (
        <div key={l.key} style={{ position: 'absolute', inset: 0, ...fadeStyle(!l.leaving && shown) }}>
          <SlideText slide={l.slide} style={style} />
        </div>
      ))}
    </>
  )
}

/** Mídia local controlada pelo estado: nada interativo, sem controles. */
function MediaLayer({ content, sinkId }: { content: MediaContent; sinkId: string | null }): JSX.Element | null {
  const ref = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const { media, playing, volume, position } = content

  useEffect(() => {
    const el = ref.current
    if (el) el.volume = Math.min(1, Math.max(0, volume))
  }, [volume, media.id])

  useEffect(() => {
    const el = ref.current
    if (el && Math.abs(el.currentTime - position) > 1) el.currentTime = position
  }, [position, media.id])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (playing) void el.play().catch(() => undefined)
    else el.pause()
  }, [playing, media.id])

  useEffect(() => {
    const el = ref.current as (HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }) | null
    if (!el?.setSinkId) return
    void el.setSinkId(sinkId ?? '').catch(() => undefined)
  }, [sinkId, media.id])

  const src = mediaUrl(media.id)
  const fit: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    background: '#000'
  }
  if (media.kind === 'image') return <img src={src} style={fit} draggable={false} alt="" />
  if (media.kind === 'video') return <video key={media.id} ref={ref} src={src} style={fit} playsInline />
  return <audio key={media.id} ref={ref} src={src} />
}

/** Placeholder: a Tarefa 13 substitui isto pelo player do YouTube. */
function YoutubePlaceholder(): JSX.Element | null {
  return null
}

function Overlay({ live }: { live: LiveState }): JSX.Element {
  const { overlay, logoMediaId } = live
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#000', ...fadeStyle(overlay === 'black') }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--navy)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...fadeStyle(overlay === 'logo')
        }}
      >
        {logoMediaId ? (
          <img
            src={mediaUrl(logoMediaId)}
            alt=""
            draggable={false}
            style={{ maxWidth: '60%', maxHeight: '60%', objectFit: 'contain' }}
          />
        ) : null}
      </div>
    </>
  )
}

export function Telao(): JSX.Element {
  const [live, setLive] = useState<LiveState | null>(null)
  const [sinkId, setSinkId] = useState<string | null>(null)

  useEffect(() => {
    let gotEvent = false
    const off = window.sonora.live.onState((s) => {
      gotEvent = true
      setLive(s)
    })
    window.sonora.live
      .get()
      .then((s) => {
        if (!gotEvent) setLive(s)
      })
      .catch(() => undefined)
    return off
  }, [])

  useEffect(() => {
    window.sonora.settings
      .get()
      .then((s) => setSinkId(s.audioOutputDeviceId))
      .catch(() => undefined)
    return window.sonora.settings.onChange((s) => setSinkId(s.audioOutputDeviceId))
  }, [])

  if (!live) return <div style={{ position: 'fixed', inset: 0, background: '#000' }} />

  const { content, overlay } = live
  const slide = content.type === 'slide' ? content.slide : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        background: '#000',
        cursor: 'none',
        userSelect: 'none'
      }}
    >
      <Background background={live.background} />
      <div style={{ position: 'absolute', inset: 0, ...fadeStyle(overlay !== 'clear') }}>
        <SlideLayers slide={slide} style={live.style} />
      </div>
      {content.type === 'media' ? <MediaLayer content={content} sinkId={sinkId} /> : null}
      {content.type === 'youtube' ? <YoutubePlaceholder /> : null}
      <Overlay live={live} />
    </div>
  )
}
