import { contextBridge, ipcRenderer } from 'electron'

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
