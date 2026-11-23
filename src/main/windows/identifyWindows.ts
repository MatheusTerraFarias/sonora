import { BrowserWindow } from 'electron'

export interface IdentifyTarget {
  number: number
  bounds: { x: number; y: number; width: number; height: number }
}

const IDENTIFY_MS = 3000

const html = (n: number): string =>
  `<!doctype html><meta charset="utf-8"><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;background:#09124F;color:#fff;font:700 40vh/1 sans-serif;overflow:hidden">${n}</body>`

/**
 * Mostra um número grande em cada monitor por 3 s e fecha as janelas.
 * Exceção deliberada ao limite de duas janelas: só existe durante a configuração.
 */
export function identifyDisplays(targets: IdentifyTarget[]): void {
  for (const t of targets) {
    const w = t.bounds.width
    const h = t.bounds.height
    const size = Math.round(Math.min(w, h) * 0.5)
    const win = new BrowserWindow({
      x: t.bounds.x + Math.round((w - size) / 2),
      y: t.bounds.y + Math.round((h - size) / 2),
      width: size,
      height: size,
      frame: false,
      show: false,
      skipTaskbar: true,
      focusable: false,
      resizable: false,
      alwaysOnTop: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    win.setAlwaysOnTop(true, 'screen-saver')
    win.once('ready-to-show', () => win.showInactive())
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html(t.number))}`)
    setTimeout(() => {
      if (!win.isDestroyed()) win.destroy()
    }, IDENTIFY_MS)
  }
}
