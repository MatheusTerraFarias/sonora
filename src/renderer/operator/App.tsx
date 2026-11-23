import { useEffect } from 'react'
import { strings } from '../shared/strings'
import { Sidebar } from './components/Sidebar'
import { Bible } from './screens/Bible'
import { ComingSoon } from './screens/ComingSoon'
import { Media } from './screens/Media'
import { Notices } from './screens/Notices'
import { Operate } from './screens/Operate'
import { Services } from './screens/Services'
import { Songs } from './screens/Songs'
import { YouTube } from './screens/YouTube'
import { useOperatorStore, watchOnlineStatus, type Section } from './store'
import './operator.css'

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
    default:
      // a Task 14 substitui este marcador
      return <ComingSoon title={strings.nav[section]} />
  }
}

export function App(): JSX.Element {
  const section = useOperatorStore((s) => s.section)
  useEffect(() => watchOnlineStatus(), [])
  return (
    <div className="shell">
      <Sidebar />
      <main className="shell__main">
        <Screen section={section} />
      </main>
    </div>
  )
}
