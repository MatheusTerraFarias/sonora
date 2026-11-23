import { useEffect, useMemo, useState } from 'react'
import type { LiveState, Service } from '../../shared/types'
import type { DisplayInfo } from '../../shared/displays'
import { pickProjectionDisplay } from '../../shared/displays'
import { useOperatorStore } from './store'

/** Estado ao vivo (assinado). null até a primeira resposta. */
export function useLiveState(): LiveState | null {
  const [live, setLive] = useState<LiveState | null>(null)
  useEffect(() => {
    let alive = true
    const off = window.sonora.live.onState((s) => alive && setLive(s))
    window.sonora.live
      .get()
      .then((s) => alive && setLive((cur) => cur ?? s))
      .catch(() => undefined)
    return () => {
      alive = false
      off()
    }
  }, [])
  return live
}

/** Rótulo do monitor do telão (mesma regra do main); null quando desconectado. */
export function useProjectionLabel(): string | null {
  const [displays, setDisplays] = useState<DisplayInfo[]>([])
  const [savedId, setSavedId] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    window.sonora.displays
      .list()
      .then((d) => alive && setDisplays(d))
      .catch(() => undefined)
    window.sonora.settings
      .get()
      .then((s) => alive && setSavedId(s.projectionDisplayId))
      .catch(() => undefined)
    const offDisplays = window.sonora.displays.onChange(setDisplays)
    const offSettings = window.sonora.settings.onChange((s) => setSavedId(s.projectionDisplayId))
    return () => {
      alive = false
      offDisplays()
      offSettings()
    }
  }, [])
  return useMemo(() => {
    const id = pickProjectionDisplay(displays, savedId, displays.find((d) => d.isOperator)?.id ?? -1)
    return id === null ? null : (displays.find((d) => d.id === id)?.label ?? null)
  }, [displays, savedId])
}

export type ServiceSummary = Omit<Service, 'items'>

/** Resumo (nome e data) do culto escolhido; acompanha a troca de culto e o contador de mudanças do store. */
export function useCurrentService(): ServiceSummary | null {
  const id = useOperatorStore((s) => s.currentServiceId)
  const version = useOperatorStore((s) => s.servicesVersion)
  const [service, setService] = useState<ServiceSummary | null>(null)
  useEffect(() => {
    if (!id) {
      setService(null)
      return
    }
    let alive = true
    window.sonora.services
      .list()
      .then((list) => alive && setService(list.find((s) => s.id === id) ?? null))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [id, version])
  return service
}
