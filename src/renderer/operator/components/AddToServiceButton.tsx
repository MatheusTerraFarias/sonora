import { useEffect, useState } from 'react'
import type { ServiceItemData } from '../../../shared/types'
import { strings } from '../../shared/strings'
import { useOperatorStore } from '../store'
import { Button, type ButtonVariant } from './ui/Button'

interface Props {
  data: ServiceItemData | null
  label?: string
  disabled?: boolean
  onAdded?: () => void
  variant?: ButtonVariant
  size?: 'sm' | 'md' | 'lg'
  /** só o ícone (o texto vira aria-label) */
  iconOnly?: boolean
  /** mostra a dica "escolha um culto" ao lado quando não há culto (a barra superior já avisa) */
  showHint?: boolean
}

/** Adiciona `data` ao culto atual; desabilitado (com dica) enquanto nenhum culto foi escolhido. */
export function AddToServiceButton({
  data,
  label = strings.addToService.button,
  disabled,
  onAdded,
  variant = 'primary',
  size = 'md',
  iconOnly,
  showHint
}: Props): JSX.Element {
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
    } catch {
      setState('error')
      return
    }
    // já salvo: uma falha ao recarregar o ao vivo não desfaz nem repete a adição
    let reloadFailed = false
    try {
      await window.sonora.live.loadService(serviceId)
    } catch {
      reloadFailed = true
    }
    setState(reloadFailed ? 'error' : 'done')
    onAdded?.()
  }

  const done = state === 'done'
  return (
    <span className="add-to-service">
      <Button
        variant={variant}
        size={size}
        icon={done ? 'check' : 'listPlus'}
        iconOnly={iconOnly}
        disabled={!serviceId || !data || disabled || state === 'busy'}
        title={!serviceId ? strings.addToService.noService : undefined}
        onClick={add}
      >
        {done ? strings.addToService.added : label}
      </Button>
      {!serviceId && showHint && <span className="hint">{strings.addToService.noService}</span>}
      {state === 'error' && (
        <span className="hint add-to-service__error" role="alert">
          {strings.common.error}
        </span>
      )}
    </span>
  )
}
