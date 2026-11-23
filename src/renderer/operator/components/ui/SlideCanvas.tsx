import { useLayoutEffect, useRef, useState } from 'react'
import { fitFontSizeWithFloor } from '../../../../shared/fitText'
import { LINE_HEIGHT, slideLayout, type SlideLayout } from '../../../../shared/slideLayout'
import type { Background, Overlay, Slide, TextStyle } from '../../../../shared/types'
import { mediaUrl } from '../MediaThumb'

/**
 * Miniatura fiel do telão: um palco fixo de 1920×1080 com a mesma geometria do telão
 * (`slideLayout`: área segura, faixa do rodapé, entrelinha) e o mesmo ajuste de texto
 * (`fitFontSizeWithFloor`), reduzido por CSS para caber na caixa. Nada de janela extra nem player de vídeo.
 */
export const STAGE_W = 1920
export const STAGE_H = 1080
/** menor tamanho (px reais na tela do operador) do rodapé na miniatura, para continuar legível */
const MIN_FOOTER_SCREEN_PX = 10

const fontStack = (style: TextStyle): string => `'${style.fontFamily}', 'Sora', system-ui, sans-serif`

let measurer: HTMLDivElement | null = null
const cache = new Map<string, number>()

/** Tamanho (px no palco) que o telão usaria para `text` numa caixa `box`. Um único elemento de medida, com cache. */
function fitPx(text: string, style: TextStyle, box: { width: number; height: number }): number {
  const key = `${style.fontFamily}|${style.minFontPx}|${style.maxFontPx}|${Math.round(box.height)}|${text}`
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
      fontWeight: '600'
    })
    document.body.appendChild(measurer)
  }
  const el = measurer
  el.style.width = `${box.width}px`
  el.style.fontFamily = fontStack(style)
  el.textContent = text
  const px = fitFontSizeWithFloor(
    (p) => {
      el.style.fontSize = `${p}px`
      return { width: el.scrollWidth, height: el.scrollHeight }
    },
    box,
    style.minFontPx,
    style.maxFontPx
  )
  // só guarda depois que a fonte carregou (antes disso a medida usa a fonte reserva)
  if (document.fonts.status === 'loaded') cache.set(key, px)
  return px
}

function useFittedPx(text: string, style: TextStyle, layout: SlideLayout): number | null {
  const [px, setPx] = useState<number | null>(null)
  const { textWidth: width, textHeight: height } = layout
  useLayoutEffect(() => {
    let cancelled = false
    const run = (): void => {
      if (!cancelled) setPx(fitPx(text, style, { width, height }))
    }
    if (document.fonts.status === 'loaded') run()
    else void document.fonts.ready.then(run, run)
    return () => {
      cancelled = true
    }
  }, [text, style.fontFamily, style.minFontPx, style.maxFontPx, width, height])
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

/**
 * Geometria do palco. O rodapé da miniatura é desenhado em px reais (legível mesmo pequeno);
 * quando isso pede mais altura do que a faixa do telão, a faixa cresce para texto e rodapé não se tocarem.
 */
function stageLayout(hasFooter: boolean, scale: number): { layout: SlideLayout; footerScreenPx: number } {
  const base = slideLayout(STAGE_W, STAGE_H, hasFooter)
  if (!hasFooter || scale <= 0) return { layout: base, footerScreenPx: base.footerPx * scale }
  const footerScreenPx = Math.max(MIN_FOOTER_SCREEN_PX, base.footerPx * scale)
  const needed = base.footerBottom + (footerScreenPx * LINE_HEIGHT) / scale + (STAGE_H * 0.02)
  return { layout: slideLayout(STAGE_W, STAGE_H, true, needed), footerScreenPx }
}

function StageBackground({ background }: { background: Background }): JSX.Element {
  if (background.type === 'image' && background.mediaId) {
    return <img className="stage__fill" src={mediaUrl(background.mediaId)} alt="" draggable={false} />
  }
  // fundo em vídeo: a miniatura usa a cor (nunca um segundo vídeo tocando)
  return <div className="stage__fill" style={{ background: background.color }} />
}

function StageText({ slide, style, layout }: { slide: Slide; style: TextStyle; layout: SlideLayout }): JSX.Element {
  const px = useFittedPx(slide.text, style, layout)
  return (
    <div className="stage__safe" style={{ top: layout.textTop, bottom: layout.textBottom }}>
      <div
        className="stage__text"
        style={{
          width: layout.textWidth,
          fontFamily: fontStack(style),
          fontSize: px ?? style.minFontPx,
          textAlign: style.align,
          color: style.color,
          textShadow: style.shadow ? '0 2px 8px rgba(0,0,0,0.8)' : 'none',
          opacity: px === null ? 0 : 1
        }}
      >
        {slide.text}
      </div>
    </div>
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
  const showText = !bare && !!slide && overlay !== 'clear'
  const hasFooter = showText && !!slide?.title
  const { layout, footerScreenPx } = stageLayout(hasFooter, scale)
  const covered = overlay === 'black' || overlay === 'logo'
  return (
    <div ref={ref} className="stage" aria-hidden="true">
      <div
        className="stage__inner"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }}
      >
        {bare ? <div className="stage__fill stage__fill--black" /> : <StageBackground background={background} />}
        {showText && slide && <StageText slide={slide} style={style} layout={layout} />}
        {overlay === 'black' && <div className="stage__fill stage__fill--black" />}
        {overlay === 'logo' && (
          <div className="stage__fill stage__logo">
            {logoMediaId ? <img src={mediaUrl(logoMediaId)} alt="" draggable={false} /> : null}
          </div>
        )}
      </div>
      {hasFooter && !covered && scale > 0 && (
        <div
          className="stage__footer"
          style={{
            bottom: layout.footerBottom * scale,
            fontFamily: fontStack(style),
            fontSize: footerScreenPx,
            lineHeight: LINE_HEIGHT,
            color: style.color,
            textShadow: style.shadow ? '0 1px 3px rgba(0,0,0,0.8)' : 'none'
          }}
        >
          {slide?.title}
        </div>
      )}
      {children && !covered && <div className="stage__overlay">{children}</div>}
    </div>
  )
}
