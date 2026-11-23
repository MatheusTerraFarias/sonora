import { contextBridge, ipcRenderer } from 'electron'
import type { ID, LiveState, MediaItem, MediaKind, Overlay, ResolvedItem, Service, ServiceItem, ServiceItemData, Settings, Song } from '../shared/types'
import type { SongInput } from '../main/repos/songs'
import type { TranslationInfo } from '../main/bible/bibleStore'
import type { YoutubeFavorite } from '../main/repos/favorites'
import type { Passage } from '../shared/slides'
import type { DisplayInfo } from '../shared/displays'

const call =
  (channel: string) =>
  (...args: unknown[]): Promise<any> =>
    ipcRenderer.invoke(channel, ...args)

/** Assina um evento enviado pelo main. Retorna a função de cancelamento. */
function on(channel: string, cb: (...args: any[]) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, ...args: any[]): void => cb(...args)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

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
  services: {
    list: call('services:list') as () => Promise<Omit<Service, 'items'>[]>,
    get: call('services:get') as (id: ID) => Promise<Service | null>,
    create: call('services:create') as (name: string, date: string) => Promise<Service>,
    rename: call('services:rename') as (id: ID, name: string, date: string) => Promise<Service>,
    duplicate: call('services:duplicate') as (id: ID, newDate: string) => Promise<Service>,
    remove: call('services:remove') as (id: ID) => Promise<void>,
    addItem: call('services:addItem') as (serviceId: ID, data: ServiceItemData, position?: number) => Promise<ServiceItem>,
    updateItem: call('services:updateItem') as (itemId: ID, data: ServiceItemData) => Promise<ServiceItem>,
    moveItem: call('services:moveItem') as (itemId: ID, toPosition: number) => Promise<Service>,
    removeItem: call('services:removeItem') as (itemId: ID) => Promise<void>,
    /** itens do culto resolvidos para exibição (título, `missing`) */
    resolve: call('services:resolve') as (serviceId: ID) => Promise<ResolvedItem[]>
  },
  favorites: {
    list: call('favorites:list') as () => Promise<YoutubeFavorite[]>,
    add: call('favorites:add') as (v: YoutubeFavorite) => Promise<void>,
    remove: call('favorites:remove') as (videoId: string) => Promise<void>
  },
  settings: {
    get: call('settings:get') as () => Promise<Settings>,
    update: call('settings:update') as (patch: Partial<Settings>) => Promise<Settings>,
    /** recebe o settings completo sempre que algo é alterado; retorna a função de cancelamento */
    onChange: (cb: (s: Settings) => void): (() => void) => on('settings:changed', cb)
  },
  live: {
    get: call('live:get') as () => Promise<LiveState>,
    goTo: call('live:goTo') as (itemId: ID, slideIndex: number) => Promise<void>,
    next: call('live:next') as () => Promise<void>,
    prev: call('live:prev') as () => Promise<void>,
    setOverlay: call('live:setOverlay') as (o: Overlay) => Promise<void>,
    media: call('live:media') as (cmd: { play?: boolean; volume?: number; position?: number }) => Promise<void>,
    /** chamar de novo sempre que o culto for alterado */
    loadService: call('live:loadService') as (serviceId: ID) => Promise<void>,
    setOnline: call('live:setOnline') as (online: boolean) => Promise<void>,
    onState: (cb: (s: LiveState) => void): (() => void) => on('live:state', cb)
  },
  displays: {
    list: call('displays:list') as () => Promise<DisplayInfo[]>
  },
  on
}

export type SonoraApi = typeof api

contextBridge.exposeInMainWorld('sonora', api)
