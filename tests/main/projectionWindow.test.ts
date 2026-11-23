import { expect, test } from 'vitest'
import { ProjectionWindowManager, type ProjectionWindowLike } from '../../src/main/windows/projectionWindow'

type Disp = { id: number; primary: boolean; bounds: { x: number; y: number; width: number; height: number } }
const disp = (id: number, x = 0): Disp => ({ id, primary: id === 1, bounds: { x, y: 0, width: 1920, height: 1080 } })

function setup(initial: Disp[], savedId: number | null = null) {
  const state = { displays: initial, savedId }
  const created: { win: ProjectionWindowLike & { bounds: Disp['bounds']; destroyed: boolean }; displayId: number }[] = []
  const mgr = new ProjectionWindowManager({
    getDisplays: () => state.displays,
    getOperatorDisplayId: () => 1,
    getSavedId: () => state.savedId,
    createWindow: (display) => {
      const win = {
        bounds: display.bounds,
        destroyed: false,
        moveTo(b: Disp['bounds']) {
          this.bounds = b
        },
        destroy() {
          this.destroyed = true
        },
        isDestroyed() {
          return this.destroyed
        }
      }
      created.push({ win, displayId: display.id })
      return win
    }
  })
  return { state, created, mgr }
}

test('um monitor: nenhuma janela criada', () => {
  const { created, mgr } = setup([disp(1)])
  mgr.sync()
  expect(created).toHaveLength(0)
})

test('dois monitores: cria janela no monitor que não é do operador', () => {
  const { created, mgr } = setup([disp(1), disp(2, 1920)])
  mgr.sync()
  expect(created).toHaveLength(1)
  expect(created[0].displayId).toBe(2)
  mgr.sync()
  expect(created).toHaveLength(1)
})

test('monitor removido destrói a janela', () => {
  const { state, created, mgr } = setup([disp(1), disp(2, 1920)])
  mgr.sync()
  state.displays = [disp(1)]
  mgr.sync()
  expect(created[0].win.destroyed).toBe(true)
})

test('monitor salvo removido move a janela para o outro monitor', () => {
  const { state, created, mgr } = setup([disp(1), disp(2, 1920), disp(3, 3840)], 2)
  mgr.sync()
  expect(created[0].displayId).toBe(2)
  state.displays = [disp(1), disp(3, 3840)]
  mgr.sync()
  expect(created).toHaveLength(1)
  expect(created[0].win.bounds).toEqual(disp(3, 3840).bounds)
})
