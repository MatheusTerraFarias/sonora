import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { Settings } from '../shared/types'

/**
 * Atualização automática opcional: só consulta o servidor com a opção ligada
 * e no app instalado. Desligada (ou em desenvolvimento), não faz requisição.
 */
export function initUpdater(settings: Pick<Settings, 'updatesEnabled'>): void {
  if (!settings.updatesEnabled || !app.isPackaged) return
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[sonora] falha ao verificar atualizações:', err)
  })
}
