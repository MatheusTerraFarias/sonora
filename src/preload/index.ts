import { contextBridge, ipcRenderer } from 'electron'
import type { ID, Song } from '../shared/types'
import type { SongInput } from '../main/repos/songs'

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
