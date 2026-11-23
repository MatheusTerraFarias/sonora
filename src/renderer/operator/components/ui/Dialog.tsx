import { useEffect, useRef } from 'react'
import { strings } from '../../../shared/strings'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
}

/** Diálogo modal nativo (<dialog>): foco preso; fecha só por Cancelar, X ou Esc (clique fora não fecha, para não perder o que foi digitado). */
export function Dialog({ open, title, description, onClose, children }: Props): JSX.Element | null {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  if (!open) return null
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
    >
      <div className="dialog__box">
        <header className="dialog__header">
          <div>
            <h2 id="dialog-title" className="dialog__title">
              {title}
            </h2>
            {description && <p className="dialog__description">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" icon="close" iconOnly onClick={onClose}>
            {strings.common.close}
          </Button>
        </header>
        <div className="dialog__body">{children}</div>
      </div>
    </dialog>
  )
}
