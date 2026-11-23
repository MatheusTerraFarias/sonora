import { useLayoutEffect, useRef, useState } from 'react'
import { fitFontSizeWithFloor } from '../../../../shared/fitText'
import type { Background, Overlay, Slide, TextStyle } from '../../../../shared/types'
import { mediaUrl } from '../MediaThumb'

/**
 * Miniatura fiel do telão: um palco fixo de 1920×1080 com as mesmas regras do telão
 * (área segura de 90%, entrelinha 1,25, peso 600, texto ajustado com `fitFontSizeWithFloor`),
 * reduzido por CSS para caber na caixa. Nada de janela extra nem player de vídeo.
 */
export const STAGE_W = 1920
export const STAGE_H = 1080
const SAFE = 0.9
const LINE_HEIGHT = 1.25

const fontStack = (style: TextStyle): string => `'${style.fontFamily}', 'Sora', system-ui, sans-serif`

let measurer: HTMLDivElement | null = null
const cache = new Map<string, number>()

/** Tamanho (px no palco 1920×1080) que o telão usaria para `text`. Um único elemento de medida, com cache. */
function fitPx(text: string, style: TextStyle): number {
  const key = `${style.fontFamily}|${style.minFontPx}|${style.maxFontPx}|${text}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  if (!measurer) {
    measurer = document.createElement('div')
    measurer.setAttribute('aria-hidden', 'true')
    Object.assign(measurer.style, {
      position: 'absolute',
      left: '-99999px',
      top: '0',
      visibility: 'hidden',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word',
      lineHeight: String(LINE_HEIGHT),
      fontWeight: '600',
      width: `${STAGE_W * SAFE}px`
    })
    document.body.appendChild(measurer)
  }
  const el = measurer
  el.style.fontFamily = fontStack(style)
  el.textContent = text
  const px = fitFontSizeWithFloor(
    (p) => {
      el.style.fontSize = `${p}px`
      return { width: el.scrollWidth, height: el.scrollHeight }
    },
    { width: STAGE_W * SAFE, height: STAGE_H * SAFE },
    style.minFontPx,
    style.maxFontPx
  )
  // só guarda depois que a fonte carregou (antes disso a medida usa a fonte reserva)
  if (document.fonts.status === 'loaded') cache.set(key, px)
  return px
}

function useFittedPx(text: string, style: TextStyle): number | null {
  const [px, setPx] = useState<number | null>(null)
  useLayoutEffect(() => {
    let cancelled = false
    const run = (): void => {
      if (!cancelled) setPx(fitPx(text, style))
    }
    if (document.fonts.status === 'loaded') run()
    else void document.fonts.ready.then(run, run)
    return () => {
      cancelled = true
    }
  }, [text, style.fontFamily, style.minFontPx, style.maxFontPx])
  return px
}

/** Escala do palco para a largura real da caixa. */
function useStageScale(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const apply = (): void => setScale(el.clientWidth / STAGE_W)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, scale]
}

function StageBackground({ background }: { background: Background }): JSX.Element {
  if (background.type === 'image' && background.mediaId) {
    return <img className="stage__fill" src={mediaUrl(background.mediaId)} alt="" draggable={false} />
  }
  // fundo em vídeo: a miniatura usa a cor (nunca um segundo vídeo tocando)
  return <div className="stage__fill" style={{ background: background.color }} />
}

function StageText({ slide, style }: { slide: Slide; style: TextStyle }): JSX.Element {
  const px = useFittedPx(slide.text, style)
  const shadow = style.shadow
  return (
    <>
      <div className="stage__safe">
        <div
          className="stage__text"
          style={{
            fontFamily: fontStack(style),
            fontSize: px ?? style.minFontPx,
            textAlign: style.align,
            color: style.color,
            textShadow: shadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
            opacity: px === null ? 0 : 1
          }}
        >
          {slide.text}
        </div>
      </div>
      {slide.title ? (
        <div
          className="stage__footer"
          style={{
            fontFamily: fontStack(style),
            color: style.color,
            textShadow: shadow ? '0 1px 4px rgba(0,0,0,0.8)' : 'none'
          }}
        >
          {slide.title}
        </div>
      ) : null}
    </>
  )
}

interface Props {
  background: Background
  style: TextStyle
  slide?: Slide | null
  /** só no monitor "No telão": reflete os botões de emergência */
  overlay?: Overlay
  logoMediaId?: string | null
  /** fundo preto em vez do fundo do telão (mídia, YouTube) */
  bare?: boolean
  /** conteúdo do operador sobre o palco (ícone + nome de mídia, mensagens) */
  children?: React.ReactNode
}

/** Palco 16:9 que imita o telão. A caixa externa define a largura; a altura segue 16:9. */
export function SlideCanvas({ background, style, slide, overlay = 'none', logoMediaId, bare, children }: Props): JSX.Element {
  const [ref, scale] = useStageScale()
  return (
    <div ref={ref} className="stage" aria-hidden="true">
      <div
        className="stage__inner"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
      >
        {bare ? <div className="stage__fill stage__fill--black" /> : <StageBackground background={background} />}
        {!bare && slide && overlay !== 'clear' && <StageText slide={slide} style={style} />}
        {overlay === 'black' && <div className="stage__fill stage__fill--black" />}
        {overlay === 'logo' && (
          <div className="stage__fill stage__logo">
            {logoMediaId ? <img src={mediaUrl(logoMediaId)} alt="" draggable={false} /> : null}
          </div>
        )}
      </div>
      {children && overlay !== 'black' && overlay !== 'logo' && <div className="stage__overlay">{children}</div>}
    </div>
  )
}
