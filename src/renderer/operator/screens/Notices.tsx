import { useState } from 'react'
import { strings } from '../../shared/strings'
import { NoticeForm, type NoticeData } from '../components/NoticeForm'
import { useOperatorStore } from '../store'

/** Avisos são criados direto como item do culto atual. */
export function Notices(): JSX.Element {
  const serviceId = useOperatorStore((s) => s.currentServiceId)
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (data: NoticeData): Promise<boolean> => {
    if (!serviceId) return false
    try {
      await window.sonora.services.addItem(serviceId, { kind: 'notice', ...data })
    } catch {
      setMessage(strings.common.error)
      return false
    }
    // já salvo (o formulário limpa e não há reenvio); falha ao recarregar só avisa
    try {
      await window.sonora.live.loadService(serviceId)
      setMessage(strings.notices.added)
    } catch {
      setMessage(strings.common.error)
    }
    return true
  }

  return (
    <section className="screen">
      <h1 className="screen__title">{strings.notices.title}</h1>
      {!serviceId && <p className="hint">{strings.addToService.noService}</p>}
      <div className="detail-pane">
        <NoticeForm onSubmit={submit} disabled={!serviceId} />
        {message && <p className="hint">{message}</p>}
      </div>
    </section>
  )
}
