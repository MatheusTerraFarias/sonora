import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { openDatabase, type Db } from './db/database'
import { handle } from './ipc'
import { createSongsRepo, type SongInput } from './repos/songs'
import { createBibleStore } from './bible/bibleStore'

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
  const bundledBible = app.isPackaged ? join(process.resourcesPath, 'bible') : join(app.getAppPath(), 'resources/bible')
  const bible = createBibleStore(join(dir, 'bible'), [bundledBible])
  handle('bible:translations', () => bible.translations())
  handle('bible:importTranslation', async (file?: string) => {
    let path = file
    if (!path) {
      const r = await dialog.showOpenDialog({
        title: 'Importar tradução da Bíblia',
        filters: [{ name: 'Bíblia (JSON)', extensions: ['json'] }],
        properties: ['openFile']
      })
      if (r.canceled || !r.filePaths[0]) return null
      path = r.filePaths[0]
    }
    return bible.importTranslation(path)
  })
  handle('bible:passage', (translationId: string, ref: string) => bible.passage(translationId, ref))
  handle('bible:search', (translationId: string, words: string, limit?: number) =>
    bible.search(translationId, words, limit)
  )
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
