import { create } from 'zustand'

export type Section = 'songs' | 'bible' | 'media' | 'notices' | 'services' | 'operation' | 'youtube' | 'settings'

interface OperatorState {
  section: Section
  /** culto que recebe os itens dos botões "Adicionar ao culto" (definido na tela Cultos) */
  currentServiceId: string | null
  setSection: (s: Section) => void
  setCurrentServiceId: (id: string | null) => void
}

export const useOperatorStore = create<OperatorState>((set) => ({
  section: 'songs',
  currentServiceId: null,
  setSection: (section) => set({ section }),
  setCurrentServiceId: (currentServiceId) => set({ currentServiceId })
}))
