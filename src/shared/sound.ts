import type { ID } from './types'

export type ChannelKind = 'wireless' | 'wired' | 'line' | 'other'

export interface SoundChannel {
  id: ID
  number: number
  name: string
  person: string
  kind: ChannelKind
  notes: string
  /** entrada do dispositivo de áudio (0-based); null = sem medidor */
  inputIndex: number | null
}

export interface ChecklistItem {
  id: ID
  text: string
}

export interface SoundMap {
  id: ID
  name: string
  channels: SoundChannel[]
  checklist: ChecklistItem[]
  createdAt: string
  updatedAt: string
}

export interface ServiceSound {
  serviceId: ID
  mapId: ID | null
  checked: ID[]
  channelNotes: Record<ID, string>
}

/** Ponto de extensão futuro (caminho 3): só o tipo, sem implementação. O monitoramento é somente leitura. */
export interface MixerConnector {
  id: string
  label: string
}
