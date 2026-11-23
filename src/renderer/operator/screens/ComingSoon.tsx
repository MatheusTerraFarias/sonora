import { strings } from '../../shared/strings'

/** Marcador das seções ainda não implementadas (substituído nas próximas tasks). */
export function ComingSoon({ title }: { title: string }): JSX.Element {
  return (
    <section className="screen">
      <h1 className="screen__title">{title}</h1>
      <p className="hint">
        {strings.common.soon}. {strings.common.soonHint}
      </p>
    </section>
  )
}
