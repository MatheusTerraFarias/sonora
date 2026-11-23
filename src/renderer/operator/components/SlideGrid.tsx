import type { Slide } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { SlideThumb } from './SlideThumb'
import './Operate.css'

interface Props {
  slides: Slide[]
  /** índice do slide que está no ar (neste item) ou -1 */
  liveIndex: number
  onPick: (index: number) => void
}

/** Grade de slides do item selecionado; clicar projeta o slide. */
export function SlideGrid({ slides, liveIndex, onPick }: Props): JSX.Element {
  if (slides.length === 0) return <p className="hint">{strings.operation.noSlides}</p>
  return (
    <ul className="slide-grid">
      {slides.map((s, i) => (
        <li key={i}>
          <button
            type="button"
            className={i === liveIndex ? 'slide-grid__cell slide-grid__cell--live' : 'slide-grid__cell'}
            aria-current={i === liveIndex ? 'true' : undefined}
            onClick={() => onPick(i)}
          >
            <SlideThumb label={s.label} text={s.title ? `${s.title}\n${s.text}` : s.text} />
          </button>
        </li>
      ))}
    </ul>
  )
}
