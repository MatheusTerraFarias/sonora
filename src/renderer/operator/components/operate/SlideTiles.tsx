import type { Background, Slide, TextStyle } from '../../../../shared/types'
import { strings } from '../../../shared/strings'
import { SlideCanvas } from '../ui/SlideCanvas'

interface Props {
  slides: Slide[]
  /** slide no ar (neste item) ou -1 */
  liveIndex: number
  /** próximo slide (neste item) ou -1 */
  cueIndex: number
  background: Background
  style: TextStyle
  onPick: (index: number) => void
}

/** Slides do item como miniaturas 16:9 do telão; Mint = no ar, Âmbar = próximo. Clicar projeta. */
export function SlideTiles({ slides, liveIndex, cueIndex, background, style, onPick }: Props): JSX.Element {
  return (
    <ul className="tiles">
      {slides.map((s, i) => {
        const live = i === liveIndex
        const cue = !live && i === cueIndex
        const cls = live ? 'tile tile--live' : cue ? 'tile tile--cue' : 'tile'
        const label = s.label || strings.operation.slides
        return (
          <li key={i}>
            <button
              type="button"
              className={cls}
              aria-current={live ? 'true' : undefined}
              aria-label={`${i + 1}. ${label}: ${s.text}`}
              onClick={() => onPick(i)}
            >
              <span className="tile__screen">
                <SlideCanvas slide={s} background={background} style={style} />
                {live && <span className="tile__tag tile__tag--live">{strings.operation.liveTag}</span>}
                {cue && <span className="tile__tag tile__tag--cue">{strings.operation.cueTag}</span>}
              </span>
              <span className="tile__caption">
                <span className="tile__label">{label}</span>
                <span className="tile__num tnum">{i + 1}</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
