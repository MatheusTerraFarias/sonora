import { useState } from 'react'
import { strings } from '../../shared/strings'
import { NoticeForm, type NoticeData } from '../components/NoticeForm'
import { Button } from '../components/ui/Button'
import { EmptyState, Notice } from '../components/ui/EmptyState'
import { PanelHeader } from '../components/ui/PanelHeader'
import { SlideCanvas } from '../components/ui/SlideCanvas'
import { useLiveState } from '../hooks'
import { useOperatorStore } from '../store'
import './Notices.css'

/** Avisos são criados direto como item do culto atual, com prévia de como ficam no telão. */
export function Notices(): JSX.Element {
  const serviceId = useOperatorStore((s) => s.currentServiceId)
  const setSection = useOperatorStore((s) => s.setSection)
  const live = useLiveState()
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [draft, setDraft] = useState<NoticeData>({ title: '', body: '', backgroundMediaId: null })

  const submit = async (data: NoticeData): Promise<boolean> => {
    if (!serviceId) return false
    try {
      await window.sonora.services.addItem(serviceId, { kind: 'notice', ...data })
    } catch {
      setMessage({ tone: 'error', text: strings.common.error })
      return false
    }
    // já salvo (o formulário limpa e não há reenvio); falha ao recarregar só avisa
    try {
      await window.sonora.live.loadService(serviceId)
      setMessage({ tone: 'ok', text: strings.notices.added })
    } catch {
      setMessage({ tone: 'error', text: strings.common.error })
    }
    return true
  }

  return (
    <section className="workspace notices">
      <PanelHeader
        level={1}
        title={strings.notices.title}
        meta={serviceId ? strings.notices.intro : undefined}
      />
      <div className="detail__scroll">
        {!serviceId ? (
          <div className="detail__empty">
            <EmptyState
              icon="megaphone"
              title={strings.notices.noServiceTitle}
              text={strings.notices.noServiceHint}
              action={
                <Button variant="primary" onClick={() => setSection('services')}>
                  {strings.shell.pickService}
                </Button>
              }
            />
          </div>
        ) : (
          <div className="detail__body notices__grid">
            <div className="stack">
              <NoticeForm onSubmit={submit} onDraftChange={setDraft} />
              {message && <Notice tone={message.tone}>{message.text}</Notice>}
            </div>
            {live && (
              <div>
                <h3 className="section-title">{strings.notices.previewSection}</h3>
                <div className="notices__preview">
                  <SlideCanvas
                    slide={{ label: strings.services.kind.notice, title: draft.title, text: draft.body || strings.notices.previewPlaceholder }}
                    background={live.background}
                    style={live.style}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
