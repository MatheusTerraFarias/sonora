import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { strings } from '../../../shared/strings'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
  /** muda a cada "Tentar de novo": a tela é remontada do zero */
  attempt: number
}

/**
 * Contém um erro de renderização numa tela: o resto do operador (trilho, barra, telão) segue.
 * Ao falhar, a tela é desmontada (efeitos limpos; ex.: o motor de medição para).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[sonora] erro na tela:', error, info.componentStack)
  }

  private retry = (): void => {
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="detail__empty" role="alert">
          <EmptyState
            icon="alert"
            title={strings.common.screenErrorTitle}
            text={strings.common.screenErrorText}
            action={
              <Button variant="primary" icon="restore" onClick={this.retry}>
                {strings.common.retry}
              </Button>
            }
          />
        </div>
      )
    }
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
