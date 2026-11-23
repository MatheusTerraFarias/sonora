import { BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { rendererUrl } from './rendererUrl'

export function createOperatorWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#09124F',
    title: 'Sonora',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  const url = rendererUrl('operator')
  if (url) win.loadURL(url)
  else win.loadFile(join(__dirname, '../renderer/operator/index.html'))
  return win
}
