import { create } from 'zustand'

export type Section = 'songs' | 'bible' | 'media' | 'notices' | 'services' | 'operation' | 'youtube' | 'settings'

interface OperatorState {
  section: Section
  /** culto que recebe os itens dos botões "Adicionar ao culto" (definido na tela Cultos) */
  currentServiceId: string | null
  setSection: (s: Section) => void
  setCurrentServiceId: (id: string | null) => void
  /** conexão combinada do main: navigator.onLine (enviado via live.setOnline) + teste real ao YouTube */
  onlineStatus: boolean
  setOnlineStatus: (online: boolean) => void
  /** muda quando a lista de cultos muda (a barra superior relê nome e data) */
  servicesVersion: number
  bumpServices: () => void
}

export const useOperatorStore = create<OperatorState>((set) => ({
  section: 'songs',
  currentServiceId: null,
  setSection: (section) => set({ section }),
  setCurrentServiceId: (currentServiceId) => set({ currentServiceId }),
  onlineStatus: typeof navigator === 'undefined' ? true : navigator.onLine,
  setOnlineStatus: (onlineStatus) => set({ onlineStatus }),
  servicesVersion: 0,
  bumpServices: () => set((s) => ({ servicesVersion: s.servicesVersion + 1 }))
}))

/**
 * Acompanha a conexão: avisa o main (live.setOnline) do navigator.onLine e guarda no store a
 * conexão combinada que ele devolve (o main já recalculou os `skip` quando ela chega aqui).
 * Mudanças vindas só do teste do main chegam por live.onOnline. Retorna o cancelamento.
 */
export function watchOnlineStatus(): () => void {
  let seq = 0
  const set = (online: boolean): void => useOperatorStore.getState().setOnlineStatus(online)
  const apply = (online: boolean): void => {
    const mine = ++seq
    void window.sonora.live
      .setOnline(online)
      .then(
        (combined) => (typeof combined === 'boolean' ? combined : online),
        () => online
      )
      .then((value) => {
        if (mine === seq) set(value)
      })
  }
  const onOnline = (): void => apply(true)
  const onOffline = (): void => apply(false)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  const offMain = window.sonora.live.onOnline((online) => {
    seq++
    set(online)
  })
  apply(navigator.onLine)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    offMain()
  }
}
