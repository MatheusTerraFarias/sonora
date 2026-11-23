import logo from '../shared/assets/logo-horizontal-escuro.svg'
import { strings } from '../shared/strings'

export function App(): JSX.Element {
  return (
    <main style={{ display: 'grid', placeItems: 'center', height: '100%', gap: 16, alignContent: 'center' }}>
      <img src={logo} alt={strings.app.name} style={{ height: 64 }} />
      <h1 style={{ margin: 0, fontWeight: 600 }}>{strings.operator.welcome}</h1>
      <p style={{ margin: 0, opacity: 0.7 }}>{strings.operator.ready}</p>
    </main>
  )
}
