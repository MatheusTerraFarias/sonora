import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { openDatabase, type Db } from './db/database'
import { handle } from './ipc'
import { createSongsRepo, type SongInput } from './repos/songs'
import { createBibleStore } from './bible/bibleStore'
import { createMediaRepo, MEDIA_EXTENSIONS } from './repos/media'
import { handleMediaProtocol, registerMediaScheme } from './media/protocol'
import { createServicesRepo, resolveItem } from './repos/services'
import { createFavoritesRepo, type YoutubeFavorite } from './repos/favorites'
import { createSettingsRepo } from './repos/settings'
import { LiveController } from './live/liveController'
import { strings } from './strings'
import type { LiveState, MediaKind, Overlay, ServiceItemData, Settings } from '../shared/types'

registerMediaScheme()

let db: Db | null = null

/** envia a todas as janelas vivas */
function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}

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
        title: strings.bible.importTitle,
        filters: [{ name: strings.bible.filterName, extensions: ['json'] }],
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
  const media = createMediaRepo(db, join(dir, 'media'))
  handleMediaProtocol(media)
  handle('media:list', (kind?: MediaKind) => media.list(kind))
  handle('media:importFile', (path: string) => media.importFile(path))
  handle('media:remove', (id: string) => media.remove(id))
  handle('media:pickAndImport', async () => {
    const r = await dialog.showOpenDialog({
      title: strings.media.importTitle,
      filters: [{ name: strings.media.filterName, extensions: MEDIA_EXTENSIONS }],
      properties: ['openFile', 'multiSelections']
    })
    if (r.canceled) return []
    return r.filePaths.map((p) => media.importFile(p))
  })
  const services = createServicesRepo(db)
  handle('services:list', () => services.list())
  handle('services:get', (id: string) => services.get(id))
  handle('services:create', (name: string, date: string) => services.create(name, date))
  handle('services:rename', (id: string, name: string, date: string) => services.rename(id, name, date))
  handle('services:duplicate', (id: string, newDate: string) => services.duplicate(id, newDate))
  handle('services:remove', (id: string) => services.remove(id))
  handle('services:addItem', (serviceId: string, data: ServiceItemData, position?: number) =>
    services.addItem(serviceId, data, position)
  )
  handle('services:updateItem', (itemId: string, data: ServiceItemData) => services.updateItem(itemId, data))
  handle('services:moveItem', (itemId: string, toPosition: number) => services.moveItem(itemId, toPosition))
  handle('services:removeItem', (itemId: string) => services.removeItem(itemId))
  handle('services:resolve', (serviceId: string) => {
    const s = services.get(serviceId)
    if (!s) return []
    const deps = { songs, media }
    return s.items.map((i) => resolveItem(i, deps))
  })
  const favorites = createFavoritesRepo(db)
  handle('favorites:list', () => favorites.list())
  handle('favorites:add', (v: YoutubeFavorite) => favorites.add(v))
  handle('favorites:remove', (videoId: string) => favorites.remove(videoId))
  const settings = createSettingsRepo(db)
  handle('settings:get', () => settings.get())
  handle('settings:update', (patch: Partial<Settings>) => settings.update(patch))
  settings.onChange((s) => {
    broadcast('settings:changed', s)
  })
  const live = new LiveController({
    services,
    resolveDeps: { songs, media },
    song: (id) => songs.get(id),
    passage: (translation, ref) => bible.passage(translation, ref),
    media,
    settings,
    send: (state: LiveState) => broadcast('live:state', state)
  })
  handle('live:get', () => live.get())
  handle('live:goTo', (itemId: string, slideIndex: number) => live.goTo(itemId, slideIndex))
  handle('live:next', () => live.next())
  handle('live:prev', () => live.prev())
  handle('live:setOverlay', (o: Overlay) => live.setOverlay(o))
  handle('live:media', (cmd: { play?: boolean; volume?: number; position?: number }) => live.media(cmd))
  handle('live:loadService', (serviceId: string) => live.loadService(serviceId))
  handle('live:setOnline', (online: boolean) => live.setOnline(online))
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
