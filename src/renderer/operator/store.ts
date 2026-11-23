import { create } from 'zustand'

export type Section = 'songs' | 'bible' | 'media' | 'notices' | 'services' | 'operation' | 'youtube' | 'settings'

interface OperatorState {
  section: Section
  /** culto que recebe os itens dos botões "Adicionar ao culto" (definido na tela Cultos) */
  currentServiceId: string | null
  setSection: (s: Section) => void
  setCurrentServiceId: (id: string | null) => void
  /** navigator.onLine + eventos online/offline (o main recebe via live.setOnline) */
  onlineStatus: boolean
  setOnlineStatus: (online: boolean) => void
}

export const useOperatorStore = create<OperatorState>((set) => ({
  section: 'songs',
  currentServiceId: null,
  setSection: (section) => set({ section }),
  setCurrentServiceId: (currentServiceId) => set({ currentServiceId }),
  onlineStatus: typeof navigator === 'undefined' ? true : navigator.onLine,
  setOnlineStatus: (onlineStatus) => set({ onlineStatus })
}))

/**
 * Acompanha a conexão: avisa o main (live.setOnline) e só então atualiza o store,
 * para que quem recarrega o culto ao ver a mudança já receba os `skip` novos.
 * Retorna o cancelamento.
 */
export function watchOnlineStatus(): () => void {
  let seq = 0
  const apply = (online: boolean): void => {
    const mine = ++seq
    void window.sonora.live
      .setOnline(online)
      .catch(() => undefined)
      .then(() => {
        if (mine === seq) useOperatorStore.getState().setOnlineStatus(online)
      })
  }
  const onOnline = (): void => apply(true)
  const onOffline = (): void => apply(false)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  apply(navigator.onLine)
  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
}
