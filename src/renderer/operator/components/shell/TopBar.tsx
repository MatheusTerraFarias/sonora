import type { LiveState } from '../../../../shared/types'
import { strings } from '../../../shared/strings'
import { firstLine, formatDate, weekday } from '../../format'
import { useCurrentService, useLiveState, useProjectionLabel } from '../../hooks'
import { useOperatorStore } from '../../store'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'

const OVERLAY_LABEL = {
  clear: strings.operation.overlayClear,
  black: strings.operation.overlayBlack,
  logo: strings.operation.overlayLogo
} as const

/** Resumo do que está no telão agora (uma linha). */
function onAirText(live: LiveState | null): string | null {
  const c = live?.content
  if (!c || c.type === 'none') return null
  if (c.type === 'slide') {
    const line = firstLine(c.slide.text)
    return c.slide.label ? `${c.slide.label} · ${line}` : line
  }
  if (c.type === 'media') return c.media.originalName
  return strings.operation.youtubeItem
}

/** Barra superior de todas as telas: culto escolhido à esquerda, estado do telão à direita. */
export function TopBar(): JSX.Element {
  const service = useCurrentService()
  const live = useLiveState()
  const projection = useProjectionLabel()
  const online = useOperatorStore((s) => s.onlineStatus)
  const section = useOperatorStore((s) => s.section)
  const setSection = useOperatorStore((s) => s.setSection)
  const onAir = onAirText(live)
  const overlay = live?.overlay ?? 'none'

  return (
    <header className="topbar">
      <div className={service ? 'topbar__service' : 'topbar__service topbar__service--none'}>
        {service ? (
          <>
            <span className="topbar__service-name">{service.name}</span>
            <span className="topbar__service-date tnum">
              {formatDate(service.date)}
              <span className="topbar__weekday"> · {weekday(service.date)}</span>
            </span>
          </>
        ) : (
          <>
            <span className="topbar__service-none">{strings.shell.noService}</span>
            {/* as telas com estado vazio próprio já oferecem o mesmo botão */}
            {section !== 'services' && section !== 'operation' && section !== 'notices' && (
              <Button variant="ghost" size="sm" onClick={() => setSection('services')}>
                {strings.shell.pickService}
              </Button>
            )}
          </>
        )}
      </div>

      <div className="topbar__status" aria-label={strings.shell.statusLabel}>
        {!online && (
          <span className="topbar__offline">
            <Icon name="wifiOff" size={16} />
            {strings.shell.offline}
          </span>
        )}
        <span className={onAir || overlay !== 'none' ? 'topbar__onair topbar__onair--live' : 'topbar__onair'}>
          <span className="topbar__dot" aria-hidden="true" />
          <span className="topbar__onair-label">{strings.shell.onAir}</span>
          {overlay !== 'none' && <span className="chip-state chip-state--muted">{OVERLAY_LABEL[overlay]}</span>}
          <span className="topbar__onair-text">{onAir ?? strings.shell.nothingOnAir}</span>
        </span>
        {projection ? (
          <span className="topbar__telao" role="status">
            <Icon name="monitor" size={16} />
            {strings.operation.monitor}: {projection}
          </span>
        ) : (
          <span className="topbar__telao topbar__telao--off" role="status">
            <Icon name="alert" size={16} />
            {strings.operation.disconnected}
          </span>
        )}
      </div>
    </header>
  )
}
