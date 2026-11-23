import { useEffect, useState } from 'react'
import type { ServiceItemData } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { useOperatorStore } from '../store'

interface Props {
  data: ServiceItemData | null
  label?: string
  disabled?: boolean
  onAdded?: () => void
}

/** Adiciona `data` ao culto atual; desabilitado (com dica) enquanto nenhum culto foi escolhido. */
export function AddToServiceButton({ data, label = strings.addToService.button, disabled, onAdded }: Props): JSX.Element {
  const serviceId = useOperatorStore((s) => s.currentServiceId)
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (state !== 'done') return
    const t = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(t)
  }, [state])

  const add = async (): Promise<void> => {
    if (!serviceId || !data) return
    setState('busy')
    try {
      await window.sonora.services.addItem(serviceId, data)
      await window.sonora.live.loadService(serviceId)
      setState('done')
      onAdded?.()
    } catch {
      setState('error')
    }
  }

  return (
    <span className="add-to-service">
      <button type="button" className="btn btn--primary" disabled={!serviceId || !data || disabled || state === 'busy'} onClick={add}>
        {state === 'done' ? strings.addToService.added : label}
      </button>
      {!serviceId && <span className="hint">{strings.addToService.noService}</span>}
      {state === 'error' && <span className="hint hint--error">{strings.common.error}</span>}
    </span>
  )
}
