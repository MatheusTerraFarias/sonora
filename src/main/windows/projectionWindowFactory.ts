import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { DisplayLike, ProjectionWindowLike } from './projectionWindow'
import { rendererUrl } from './rendererUrl'
import { attachCrashRecovery } from './crashRecovery'

/** cria a janela real do telão (tela cheia, sem moldura, sem foco); recupera-se sozinha se o renderer cair ou travar */
export function createProjectionBrowserWindow(
  display: DisplayLike,
  onLoaded: (win: BrowserWindow) => void
): ProjectionWindowLike {
  const win = new BrowserWindow({
    frame: false,
    show: false,
    skipTaskbar: true,
    focusable: false,
    backgroundColor: '#000000',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // player do YouTube; endurecido em hardenWebviews (main/youtube/session.ts)
      webviewTag: true
    }
  })
  win.setBounds(display.bounds)
  win.setFullScreen(true)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.once('ready-to-show', () => win.showInactive())
  // a cada carga (inclusive depois de recuperar de uma queda) o telão recebe o estado ao vivo
  win.webContents.on('did-finish-load', () => onLoaded(win))
  attachCrashRecovery(win.webContents, (reason) => console.warn('[sonora] telão recarregado:', reason))
  const url = rendererUrl('telao')
  if (url) win.loadURL(url)
  else win.loadFile(join(__dirname, '../renderer/telao/index.html'))
  return {
    moveTo(bounds) {
      // esconde primeiro: o SO pode ter levado a janela ao monitor do operador
      win.hide()
      win.setFullScreen(false)
      win.setBounds(bounds)
      win.setFullScreen(true)
      win.showInactive()
    },
    destroy: () => {
      if (!win.isDestroyed()) win.hide()
      win.destroy()
    },
    isDestroyed: () => win.isDestroyed(),
    webContentsId: () => win.webContents.id
  }
}
