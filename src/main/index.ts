import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { openDatabase, type Db } from './db/database'
import { handle } from './ipc'
import { createSongsRepo, type SongInput } from './repos/songs'

let db: Db | null = null

function rendererUrl(page: 'operator' | 'telao'): string | null {
  const base = process.env['ELECTRON_RENDERER_URL']
  return base ? `${base}/${page}/index.html` : null
}

function createOperatorWindow(): BrowserWindow {
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

app.whenReady().then(() => {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = openDatabase(join(dir, 'sonora.db'))
  handle('app:version', () => app.getVersion())
  const songs = createSongsRepo(db)
  handle('songs:list', (query?: string) => songs.list(query))
  handle('songs:get', (id: string) => songs.get(id))
  handle('songs:create', (input: SongInput) => songs.create(input))
  handle('songs:update', (id: string, input: SongInput) => songs.update(id, input))
  handle('songs:setArrangement', (id: string, arrangement: string[]) => songs.setArrangement(id, arrangement))
  handle('songs:remove', (id: string) => songs.remove(id))
  createOperatorWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createOperatorWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  db?.close()
  db = null
})
