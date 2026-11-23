import { useEffect } from 'react'
// estilos base antes das telas: o CSS de cada tela vem depois e pode refinar o comum
import './base.css'
import './components/ui/ui.css'
import './components/shell/shell.css'
import './screens/library.css'
import { NavRail } from './components/shell/NavRail'
import { TopBar } from './components/shell/TopBar'
import { Bible } from './screens/Bible'
import { Settings } from './screens/Settings'
import { Media } from './screens/Media'
import { Notices } from './screens/Notices'
import { Operate } from './screens/Operate'
import { Services } from './screens/Services'
import { Songs } from './screens/Songs'
import { YouTube } from './screens/YouTube'
import { useOperatorStore, watchOnlineStatus, type Section } from './store'

function Screen({ section }: { section: Section }): JSX.Element {
  switch (section) {
    case 'songs':
      return <Songs />
    case 'bible':
      return <Bible />
    case 'media':
      return <Media />
    case 'notices':
      return <Notices />
    case 'services':
      return <Services />
    case 'operation':
      return <Operate />
    case 'youtube':
      return <YouTube />
    case 'settings':
      return <Settings />
  }
}

export function App(): JSX.Element {
  const section = useOperatorStore((s) => s.section)
  useEffect(() => watchOnlineStatus(), [])
  return (
    <div className="shell">
      <NavRail />
      <TopBar />
      <main className="shell__main">
        <Screen section={section} />
      </main>
    </div>
  )
}
