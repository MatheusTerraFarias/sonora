import { app, BrowserWindow, dialog, screen } from 'electron'
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
import { createOperatorWindow } from './windows/operatorWindow'
import { ProjectionWindowManager } from './windows/projectionWindow'
import { createProjectionBrowserWindow } from './windows/projectionWindowFactory'
import type { DisplayInfo } from '../shared/displays'
import type { LiveState, MediaKind, Overlay, ServiceItemData, Settings } from '../shared/types'

registerMediaScheme()

let db: Db | null = null

/** envia a todas as janelas vivas */
function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
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
  handle('live:outline', () => live.outline())
  handle('live:setOnline', (online: boolean) => live.setOnline(online))
  const operatorWin = createOperatorWindow()
  operatorWin.on('closed', () => app.quit())
  const primaryId = (): number => screen.getPrimaryDisplay().id
  const operatorDisplayId = (): number =>
    operatorWin.isDestroyed() ? primaryId() : screen.getDisplayMatching(operatorWin.getBounds()).id
  const projection = new ProjectionWindowManager({
    getDisplays: () => screen.getAllDisplays().map((d) => ({ id: d.id, primary: d.id === primaryId(), bounds: d.bounds })),
    getOperatorDisplayId: operatorDisplayId,
    getSavedId: () => settings.get().projectionDisplayId,
    createWindow: (display) =>
      createProjectionBrowserWindow(display, (win) => {
        if (!win.isDestroyed()) win.webContents.send('live:state', live.get())
      })
  })
  const listDisplays = (): DisplayInfo[] => {
    const opId = operatorDisplayId()
    return screen.getAllDisplays().map((d, i) => ({
      id: d.id,
      label: strings.displays.monitor(i + 1, d.size.width, d.size.height),
      primary: d.id === primaryId(),
      isOperator: d.id === opId
    }))
  }
  handle('displays:list', listDisplays)
  /** sincroniza o telão e avisa o operador da nova lista de monitores */
  const syncProjection = (): void => {
    projection.sync()
    broadcast('displays:changed', listDisplays())
  }
  let lastSaved = settings.get().projectionDisplayId
  settings.onChange((s) => {
    if (s.projectionDisplayId !== lastSaved) {
      lastSaved = s.projectionDisplayId
      syncProjection()
    }
  })
  screen.on('display-added', () => syncProjection())
  screen.on('display-removed', () => syncProjection())
  screen.on('display-metrics-changed', () => syncProjection())
  operatorWin.on('moved', () => syncProjection())
  syncProjection()
  app.on('before-quit', () => projection.destroy())
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  db?.close()
  db = null
})
