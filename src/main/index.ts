import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
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
import { cleanupRestoreLeftovers, exportBackup, restoreBackup } from './backup'
import { initUpdater } from './updater'
import { identifyDisplays } from './windows/identifyWindows'
import { fetchOembed, hardenWebviews } from './youtube/session'
import type { DisplayInfo } from '../shared/displays'
import type { LiveProgress, LiveState, MediaKind, Overlay, ServiceItemData, Settings } from '../shared/types'

registerMediaScheme()

let db: Db | null = null

/** envia a todas as janelas vivas */
function broadcast(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}

/** liga/desliga o bloqueador; com SONORA_ADBLOCK=0 o módulo nem entra no build */
async function applyAdblock(enabled: boolean): Promise<void> {
  if (!__ADBLOCK__) return
  try {
    const { setAdblock } = await import('./youtube/adblock')
    await setAdblock(enabled)
  } catch (err) {
    console.warn('[sonora] bloqueador de anúncios indisponível:', err)
  }
}

// SONORA_USER_DATA: pasta de dados alternativa (teste de fumaça). Vale fora do app instalado;
// no app instalado só com SONORA_ALLOW_USER_DATA=1, para que uma variável perdida não troque os dados.
if (process.env.SONORA_USER_DATA && (!app.isPackaged || process.env.SONORA_ALLOW_USER_DATA === '1')) {
  app.setPath('userData', process.env.SONORA_USER_DATA)
}

app.whenReady().then(() => {
  let operatorWin: BrowserWindow | null = null
  hardenWebviews((embedder) => !!operatorWin && !operatorWin.isDestroyed() && embedder === operatorWin.webContents)
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = openDatabase(join(dir, 'sonora.db'))
  // banco abriu: dados antigos de uma restauração anterior já podem ser descartados
  const leftovers = cleanupRestoreLeftovers(dir)
  for (const p of leftovers.stranded) console.warn('[sonora] restauração interrompida; dados originais em:', p)
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
  initUpdater(settings.get())
  let adblockOn = settings.get().adblockEnabled
  if (adblockOn) void applyAdblock(true)
  settings.onChange((s) => {
    if (s.adblockEnabled === adblockOn) return
    adblockOn = s.adblockEnabled
    void applyAdblock(adblockOn)
  })
  handle('youtube:oembed', (videoId: string) => fetchOembed(String(videoId)))
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
  const opWin = createOperatorWindow()
  operatorWin = opWin
  opWin.on('closed', () => app.quit())
  // progresso de reprodução informado pelo telão: só repassado ao operador (não altera LiveState.position)
  ipcMain.on('live:progress', (event, p: LiveProgress) => {
    if (event.sender === opWin.webContents || opWin.isDestroyed() || !p || typeof p.key !== 'string') return
    const position = Number(p.position)
    const duration = Number(p.duration)
    if (!Number.isFinite(position) || !Number.isFinite(duration)) return
    opWin.webContents.send('live:progress', { key: p.key, position, duration } satisfies LiveProgress)
  })
  const primaryId = (): number => screen.getPrimaryDisplay().id
  const operatorDisplayId = (): number =>
    opWin.isDestroyed() ? primaryId() : screen.getDisplayMatching(opWin.getBounds()).id
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
  handle('displays:identify', () =>
    identifyDisplays(screen.getAllDisplays().map((d, i) => ({ number: i + 1, bounds: d.bounds })))
  )
  const stamp = (): string => new Date().toISOString().slice(0, 10)
  handle('backup:export', async () => {
    if (!db) return null
    const r = await dialog.showSaveDialog({
      title: strings.backup.exportTitle,
      defaultPath: `sonora-backup-${stamp()}.sonora`,
      filters: [{ name: strings.backup.filterName, extensions: ['sonora'] }]
    })
    if (r.canceled || !r.filePath) return null
    await exportBackup(db, dir, r.filePath, app.getVersion())
    return r.filePath
  })
  handle('backup:restore', async () => {
    const r = await dialog.showOpenDialog({
      title: strings.backup.restoreTitle,
      filters: [{ name: strings.backup.filterName, extensions: ['sonora'] }],
      properties: ['openFile']
    })
    const file = r.filePaths[0]
    if (r.canceled || !file) return false
    const c = await dialog.showMessageBox({
      type: 'warning',
      title: strings.backup.confirmTitle,
      message: strings.backup.confirmMessage,
      detail: strings.backup.confirmDetail,
      buttons: [strings.backup.confirmYes, strings.backup.confirmNo],
      defaultId: 1,
      cancelId: 1
    })
    if (c.response !== 0) return false
    try {
      await restoreBackup(file, dir, {
        beforeSwap: () => {
          db?.close()
          db = null
        }
      })
    } catch (err) {
      // banco já fechado (falha na troca): avisa e só então reinicia para reabrir os dados
      if (!db) {
        await dialog.showMessageBox({
          type: 'error',
          title: strings.backup.failedTitle,
          message: strings.backup.failedMessage,
          detail: err instanceof Error ? err.message : String(err),
          buttons: [strings.backup.failedOk]
        })
        app.relaunch()
        app.exit()
      }
      throw err
    }
    app.relaunch()
    app.exit()
    return true
  })
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
  opWin.on('moved', () => syncProjection())
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
