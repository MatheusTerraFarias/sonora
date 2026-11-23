import { contextBridge, ipcRenderer } from 'electron'
import type { ID, MediaItem, MediaKind, Song } from '../shared/types'
import type { SongInput } from '../main/repos/songs'
import type { TranslationInfo } from '../main/bible/bibleStore'
import type { Passage } from '../shared/slides'

const call =
  (channel: string) =>
  (...args: unknown[]): Promise<any> =>
    ipcRenderer.invoke(channel, ...args)

/**
 * Cada task seguinte adiciona seu grupo (songs, bible, media, services,
 * favorites, settings, live, displays, backup) aqui, via `call('grupo:acao')`.
 */
export const api = {
  app: {
    version: call('app:version')
  },
  songs: {
    list: call('songs:list') as (query?: string) => Promise<Song[]>,
    get: call('songs:get') as (id: ID) => Promise<Song | null>,
    create: call('songs:create') as (input: SongInput) => Promise<Song>,
    update: call('songs:update') as (id: ID, input: SongInput) => Promise<Song>,
    setArrangement: call('songs:setArrangement') as (id: ID, arrangement: ID[]) => Promise<Song>,
    remove: call('songs:remove') as (id: ID) => Promise<void>
  },
  bible: {
    translations: call('bible:translations') as () => Promise<TranslationInfo[]>,
    /** sem `file`, abre o seletor de arquivos; null se cancelado */
    importTranslation: call('bible:importTranslation') as (file?: string) => Promise<TranslationInfo | null>,
    passage: call('bible:passage') as (translationId: string, ref: string) => Promise<Passage | null>,
    search: call('bible:search') as (
      translationId: string,
      words: string,
      limit?: number
    ) => Promise<{ ref: string; text: string }[]>
  },
  media: {
    list: call('media:list') as (kind?: MediaKind) => Promise<MediaItem[]>,
    importFile: call('media:importFile') as (path: string) => Promise<MediaItem>,
    remove: call('media:remove') as (id: ID) => Promise<void>,
    /** abre o seletor (várias seleções); [] se cancelado */
    pickAndImport: call('media:pickAndImport') as () => Promise<MediaItem[]>
  },
  /** Assina um evento enviado pelo main. Retorna a função de cancelamento. */
  on(channel: string, cb: (...args: any[]) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]): void => cb(...args)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

export type SonoraApi = typeof api

contextBridge.exposeInMainWorld('sonora', api)
