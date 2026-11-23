import { ipcMain } from 'electron'

/** Registra um handler para um canal IPC (invoke). */
export function handle<T extends (...a: any[]) => any>(channel: string, fn: T): void {
  ipcMain.handle(channel, (_event, ...args) => fn(...args))
}
