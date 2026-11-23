import { pickProjectionDisplay } from '../../shared/displays'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}
export interface DisplayLike {
  id: number
  primary: boolean
  bounds: Bounds
}
export interface ProjectionWindowLike {
  /** reposiciona a janela no monitor indicado */
  moveTo(bounds: Bounds): void
  destroy(): void
  isDestroyed(): boolean
}
export interface ProjectionDeps {
  getDisplays(): DisplayLike[]
  getOperatorDisplayId(): number
  getSavedId(): number | null
  createWindow(display: DisplayLike): ProjectionWindowLike
}

/** Mantém a janela do telão no monitor certo; sem segundo monitor, não há janela. */
export class ProjectionWindowManager {
  private win: ProjectionWindowLike | null = null

  constructor(private readonly deps: ProjectionDeps) {}

  get window(): ProjectionWindowLike | null {
    return this.win && !this.win.isDestroyed() ? this.win : null
  }

  sync(): void {
    const displays = this.deps.getDisplays()
    const id = pickProjectionDisplay(displays, this.deps.getSavedId(), this.deps.getOperatorDisplayId())
    const display = id === null ? undefined : displays.find((d) => d.id === id)
    const current = this.window
    if (!display) {
      if (current) current.destroy()
      this.win = null
      return
    }
    if (current) current.moveTo(display.bounds)
    else this.win = this.deps.createWindow(display)
  }

  destroy(): void {
    if (this.window) this.window.destroy()
    this.win = null
  }
}
