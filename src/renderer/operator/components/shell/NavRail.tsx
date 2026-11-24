import symbol from '../../../shared/assets/simbolo-branco.svg'
import { strings } from '../../../shared/strings'
import { useOperatorStore, type Section } from '../../store'
import { Icon, type IconName } from '../ui/Icon'

interface Item {
  section: Section
  label: string
  icon: IconName
}

const MAIN: Item[] = [
  { section: 'operation', label: strings.nav.operation, icon: 'operation' },
  { section: 'services', label: strings.nav.services, icon: 'services' },
  { section: 'sound', label: strings.nav.sound, icon: 'sliders' }
]
const LIBRARY: Item[] = [
  { section: 'songs', label: strings.nav.songs, icon: 'music' },
  { section: 'bible', label: strings.nav.bible, icon: 'book' },
  { section: 'media', label: strings.nav.media, icon: 'image' },
  { section: 'notices', label: strings.nav.notices, icon: 'megaphone' },
  { section: 'youtube', label: strings.nav.youtube, icon: 'youtube' }
]
const SETTINGS: Item = { section: 'settings', label: strings.nav.settingsShort, icon: 'settings' }

function RailButton({ item }: { item: Item }): JSX.Element {
  const section = useOperatorStore((s) => s.section)
  const setSection = useOperatorStore((s) => s.setSection)
  const active = item.section === section
  return (
    <li>
      <button
        type="button"
        className={active ? 'rail__item rail__item--active' : 'rail__item'}
        aria-current={active ? 'page' : undefined}
        onClick={() => setSection(item.section)}
      >
        <Icon name={item.icon} size={20} />
        <span className="rail__label">{item.label}</span>
      </button>
    </li>
  )
}

/** Trilho de navegação: símbolo no topo, ícones com rótulo curto. */
export function NavRail(): JSX.Element {
  return (
    <nav className="rail" aria-label={strings.nav.ariaLabel}>
      <img className="rail__symbol" src={symbol} alt={strings.app.name} />
      <ul className="rail__group">
        {MAIN.map((it) => (
          <RailButton key={it.section} item={it} />
        ))}
      </ul>
      <span className="rail__divider" aria-hidden="true" />
      <ul className="rail__group">
        {LIBRARY.map((it) => (
          <RailButton key={it.section} item={it} />
        ))}
      </ul>
      <ul className="rail__group rail__group--end">
        <RailButton item={SETTINGS} />
      </ul>
    </nav>
  )
}
