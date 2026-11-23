import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { LiveState } from '../src/shared/types'

const root = resolve(__dirname, '..')
const shots = join(__dirname, 'screenshots')

test('cadastra música, monta culto e avança o slide ao vivo', async () => {
  mkdirSync(shots, { recursive: true })
  const userData = mkdtempSync(join(tmpdir(), 'sonora-e2e-'))
  let app: ElectronApplication | undefined
  try {
    app = await electron.launch({
      args: [join(root, 'out/main/index.js')],
      env: { ...process.env, SONORA_USER_DATA: userData }
    })
    // a primeira janela é a do operador; o telão só abre com um segundo monitor
    const win = await app.firstWindow()
    await win.setViewportSize({ width: 1280, height: 800 })
    await win.waitForSelector('.sidebar')

    // música: título + letra colada (duas estrofes = dois slides)
    await win.getByRole('button', { name: 'Músicas', exact: true }).click()
    await win.getByRole('button', { name: 'Nova música' }).click()
    await win.getByLabel('Título').fill('Hino de Teste')
    await win.getByLabel('Letra').fill('[Estrofe 1]\nPrimeiro verso\nlinha dois\n\n[Estrofe 2]\nSegundo verso\nlinha quatro')
    await win.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(win.getByRole('button', { name: /Hino de Teste/ })).toBeVisible()
    await win.screenshot({ path: join(shots, '1-musicas.png') })

    // culto: criar (fica selecionado) e adicionar a música
    await win.getByRole('button', { name: 'Cultos', exact: true }).click()
    await win.getByLabel('Nome').first().fill('Culto de Teste')
    await win.getByRole('button', { name: 'Criar culto' }).click()
    await expect(win.getByRole('button', { name: /Culto de Teste/ })).toBeVisible()
    await win.getByRole('button', { name: 'Músicas', exact: true }).click()
    await win.getByRole('button', { name: /Hino de Teste/ }).click()
    await win.getByRole('button', { name: 'Adicionar ao culto' }).click()
    await expect(win.getByText('Adicionado ao culto')).toBeVisible()
    await win.getByRole('button', { name: 'Cultos', exact: true }).click()
    await expect(win.getByText('Hino de Teste').first()).toBeVisible()
    await win.screenshot({ path: join(shots, '2-cultos.png') })

    // operação: → leva ao segundo slide
    await win.getByRole('button', { name: 'Operação', exact: true }).click()
    await expect(win.getByText('Hino de Teste').first()).toBeVisible()
    const text = (s: LiveState): string => (s.content.type === 'slide' ? s.content.slide.text : '')
    const live = (): Promise<LiveState> => win.evaluate(() => (window as any).sonora.live.get())
    await win.locator('body').click({ position: { x: 5, y: 5 } })
    // sem posição atual o primeiro → coloca o primeiro slide no ar; o segundo leva ao slide 2
    await win.keyboard.press('ArrowRight')
    await expect.poll(async () => text(await live())).toContain('Primeiro verso')
    await win.keyboard.press('ArrowRight')
    await expect.poll(async () => text(await live())).toContain('Segundo verso')
    await win.screenshot({ path: join(shots, '3-operacao.png') })

    // a janela do operador não sai do próprio renderer (ex.: arquivo solto nela)
    const before = win.url()
    await win.evaluate(() => {
      location.href = 'file:///C:/Windows/win.ini'
    })
    await win.waitForTimeout(500)
    expect(win.url()).toBe(before)
    // (a navegação cancelada confunde a espera de navegação do Playwright: lê o DOM direto)
    expect(await win.evaluate(() => !!document.querySelector('.sidebar') && location.href)).toBe(before)
  } finally {
    await app?.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
