import { BrowserWindow } from 'electron'
import { join } from 'node:path'
import type { DisplayLike, ProjectionWindowLike } from './projectionWindow'
import { rendererUrl } from './rendererUrl'

/** cria a janela real do telão (tela cheia, sem moldura, sem foco) */
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
      sandbox: false
    }
  })
  win.setBounds(display.bounds)
  win.setFullScreen(true)
  win.setAlwaysOnTop(true, 'screen-saver')
  win.once('ready-to-show', () => win.showInactive())
  win.webContents.once('did-finish-load', () => onLoaded(win))
  const url = rendererUrl('telao')
  if (url) win.loadURL(url)
  else win.loadFile(join(__dirname, '../renderer/telao/index.html'))
  return {
    moveTo(bounds) {
      win.setFullScreen(false)
      win.setBounds(bounds)
      win.setFullScreen(true)
    },
    destroy: () => win.destroy(),
    isDestroyed: () => win.isDestroyed()
  }
}
