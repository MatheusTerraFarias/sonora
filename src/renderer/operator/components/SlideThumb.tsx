import './SlideThumb.css'

interface Props {
  label?: string
  text: string
}

/** Miniatura de um slide de texto (rótulo + trecho). */
export function SlideThumb({ label, text }: Props): JSX.Element {
  return (
    <div className="slide-thumb">
      {label && <span className="slide-thumb__label">{label}</span>}
      <p className="slide-thumb__text">{text}</p>
    </div>
  )
}
