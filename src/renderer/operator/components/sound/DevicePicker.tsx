import { useEffect, useState } from 'react'
import { strings } from '../../../shared/strings'

const S = strings.sound

interface Props {
  value: string | null
  /** muda quando vale reler a lista (ex.: depois da permissão os nomes aparecem) */
  refreshKey: string
  onChange: (deviceId: string | null) => void
}

/** Entradas de áudio do Windows (enumerateDevices, audioinput); "Padrão do sistema" = null. */
export function DevicePicker({ value, refreshKey, onChange }: Props): JSX.Element {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let alive = true
    const load = (): void => {
      navigator.mediaDevices
        .enumerateDevices()
        .then((list) => {
          // "default"/"communications" são apelidos do Windows para um dispositivo real: o padrão já cobre
          if (alive) setDevices(list.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'default' && d.deviceId !== 'communications'))
        })
        .catch(() => alive && setDevices([]))
    }
    load()
    navigator.mediaDevices.addEventListener('devicechange', load)
    return () => {
      alive = false
      navigator.mediaDevices.removeEventListener('devicechange', load)
    }
  }, [refreshKey])

  const missing = value !== null && !devices.some((d) => d.deviceId === value)
  return (
    <label className="sound-picker">
      <span className="sound-picker__label">{S.device}</span>
      <select
        className="input sound-picker__select"
        aria-label={S.deviceLabel}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{S.deviceDefault}</option>
        {devices.map((d, i) => (
          <option key={d.deviceId || i} value={d.deviceId}>
            {d.label || S.deviceUnnamed(i + 1)}
          </option>
        ))}
        {missing && <option value={value}>{S.deviceMissing}</option>}
      </select>
    </label>
  )
}
