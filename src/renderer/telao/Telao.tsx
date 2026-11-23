import { useEffect, useState } from 'react'
import type { LiveState } from '../../shared/types'

export function Telao(): JSX.Element {
  // Task 10 renderiza o conteúdo; aqui só garantimos que o estado atual chega ao telão.
  const [, setLive] = useState<LiveState | null>(null)
  useEffect(() => {
    void window.sonora.live.get().then(setLive)
    return window.sonora.live.onState(setLive)
  }, [])
  return <div style={{ width: '100%', height: '100%', background: '#000' }} />
}
