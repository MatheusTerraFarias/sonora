import logo from '../../shared/assets/logo-horizontal-escuro.svg'
import { strings } from '../../shared/strings'
import { useOperatorStore, type Section } from '../store'
import './Sidebar.css'

const ITEMS: { section: Section; label: string }[] = [
  { section: 'songs', label: strings.nav.songs },
  { section: 'bible', label: strings.nav.bible },
  { section: 'media', label: strings.nav.media },
  { section: 'notices', label: strings.nav.notices },
  { section: 'services', label: strings.nav.services },
  { section: 'operation', label: strings.nav.operation },
  { section: 'youtube', label: strings.nav.youtube },
  { section: 'settings', label: strings.nav.settings }
]

export function Sidebar(): JSX.Element {
  const section = useOperatorStore((s) => s.section)
  const setSection = useOperatorStore((s) => s.setSection)
  return (
    <nav className="sidebar" aria-label={strings.nav.ariaLabel}>
      <img className="sidebar__logo" src={logo} alt={strings.app.name} />
      <ul>
        {ITEMS.map((it) => (
          <li key={it.section}>
            <button
              type="button"
              className={it.section === section ? 'sidebar__item sidebar__item--active' : 'sidebar__item'}
              aria-current={it.section === section ? 'page' : undefined}
              onClick={() => setSection(it.section)}
            >
              {it.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
