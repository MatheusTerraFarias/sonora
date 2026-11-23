import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Semeia dados de exemplo (músicas, passagem, mídias, aviso, cultos, um item no ar) e salva
 * uma captura de cada tela do operador em e2e/screenshots/ (1280×800) para conferência visual.
 * As letras são texto de exemplo escrito para o teste.
 */

const root = resolve(__dirname, '..')
const shots = join(__dirname, 'screenshots')

const SONGS = [
  {
    title: 'Luz da manhã',
    artist: 'Coral Aurora',
    key: 'G',
    lyrics: `[Estrofe 1]
Quando a noite se desfaz
e o silêncio vira canção
a tua luz me alcança
e acende o meu coração

[Refrão]
Luz da manhã, brilha em mim
guia meus passos até o fim
luz da manhã, nova manhã
tudo se faz novo em ti

[Estrofe 2]
Cada passo no caminho
cada pedra, cada chão
tua mão segura a minha
e me ensina a direção

[Ponte]
Não há sombra que resista
ao clarão do teu amor`
  },
  {
    title: 'Caminho de paz',
    artist: 'Ministério Ponte',
    key: 'D',
    lyrics: `[Estrofe 1]
Sigo em frente sem temer
há um caminho de paz
mesmo quando o vento sopra
teu cuidado me refaz

[Refrão]
Paz que excede o entendimento
paz que acalma o mar
no teu nome eu descanso
e aprendo a confiar`
  },
  {
    title: 'Tua graça me sustenta',
    artist: 'Grupo Esperança',
    key: 'E',
    lyrics: `[Estrofe 1]
Tua graça me sustenta
dia a dia, hora a hora

[Refrão]
Graça que não se esgota
amor que não tem fim`
  },
  {
    title: 'Vem, enche este lugar',
    artist: 'Coral Aurora',
    key: 'A',
    lyrics: `[Estrofe 1]
Vem, enche este lugar
com a tua presença

[Refrão]
Aqui estamos, de mãos abertas`
  }
]

/** imagem PNG gerada a partir de um SVG (fundo do telão, logo, foto de exemplo) */
function png(dir: string, name: string, svg: string): string {
  const path = join(dir, name)
  writeFileSync(path, new Resvg(svg).render().asPng())
  return path
}

const BACKGROUND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
<defs>
<radialGradient id="a" cx="30%" cy="20%" r="90%"><stop offset="0" stop-color="#1f3a9a"/><stop offset="0.55" stop-color="#0b1660"/><stop offset="1" stop-color="#050a2a"/></radialGradient>
<radialGradient id="b" cx="85%" cy="90%" r="60%"><stop offset="0" stop-color="#127a6a" stop-opacity="0.55"/><stop offset="1" stop-color="#127a6a" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1920" height="1080" fill="url(#a)"/><rect width="1920" height="1080" fill="url(#b)"/>
</svg>`

const SUNSET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2f77"/><stop offset="0.55" stop-color="#c8607a"/><stop offset="1" stop-color="#f2b33d"/></linearGradient></defs>
<rect width="1280" height="720" fill="url(#s)"/><circle cx="640" cy="560" r="120" fill="#ffd98a" opacity="0.9"/>
<path d="M0 600 Q320 540 640 610 T1280 590 V720 H0Z" fill="#1a1440"/>
</svg>`

async function shot(win: Page, name: string): Promise<void> {
  // deixa fontes, miniaturas e transições assentarem
  await win.waitForTimeout(400)
  await win.screenshot({ path: join(shots, name) })
}

test('capturas de todas as telas do operador com dados de exemplo', async () => {
  test.setTimeout(120_000)
  mkdirSync(shots, { recursive: true })
  const userData = mkdtempSync(join(tmpdir(), 'sonora-shots-'))
  const assets = mkdtempSync(join(tmpdir(), 'sonora-assets-'))
  let app: ElectronApplication | undefined
  try {
    const bgPath = png(assets, 'fundo-azul.png', BACKGROUND_SVG)
    const sunsetPath = png(assets, 'por-do-sol.png', SUNSET_SVG)
    const logoSvg = readFileSync(join(root, 'brand/logo/simbolo-branco.svg'), 'utf8').replace(
      '<svg ',
      '<svg width="800" height="700" '
    )
    const logoPath = png(assets, 'logo-igreja.png', logoSvg)
    const biblePath = join(root, 'tests/fixtures/bible-test.json')

    app = await electron.launch({
      args: [join(root, 'out/main/index.js')],
      env: { ...process.env, SONORA_USER_DATA: userData }
    })
    const win = await app.firstWindow()
    await win.setViewportSize({ width: 1280, height: 800 })
    await win.waitForSelector('.rail')

    // ---------- dados de exemplo (pela API exposta ao operador) ----------
    await win.evaluate(
      async ({ songs, bgPath, sunsetPath, logoPath, biblePath }) => {
        const s = (window as any).sonora
        const today = new Date()
        const iso = (d: Date): string =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const plus = (n: number): string => iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n))

        const bg = await s.media.importFile(bgPath)
        const sunset = await s.media.importFile(sunsetPath)
        const logo = await s.media.importFile(logoPath)
        const current = await s.settings.get()
        await s.settings.update({
          churchName: 'Comunidade Esperança',
          logoMediaId: logo.id,
          background: { ...current.background, type: 'image', mediaId: bg.id }
        })
        await s.bible.importTranslation(biblePath)

        const created = []
        for (const song of songs) {
          created.push(await s.songs.create({ ...song, tags: ['louvor'], attachment: null }))
        }
        await s.favorites.add({ videoId: 'aqz-KE-bpKQ', title: 'Abertura do culto', channel: 'Canal da igreja', thumbnail: '' })

        const sunday = await s.services.create('Culto de domingo', plus(0))
        await s.services.create('Culto de oração', plus(3))
        await s.services.create('Culto de jovens', plus(-6))
        const first = await s.services.addItem(sunday.id, { kind: 'song', songId: created[0].id })
        await s.services.addItem(sunday.id, { kind: 'bible', ref: 'João 3:1-3', translation: 'TESTE' })
        await s.services.addItem(sunday.id, { kind: 'song', songId: created[1].id })
        await s.services.addItem(sunday.id, { kind: 'media', mediaId: sunset.id })
        await s.services.addItem(sunday.id, {
          kind: 'youtube',
          videoId: 'aqz-KE-bpKQ',
          title: 'Abertura do culto',
          thumbnail: ''
        })
        await s.services.addItem(sunday.id, {
          kind: 'notice',
          title: 'Café da comunidade',
          body: 'Depois do culto, no salão social.\nTodos são bem-vindos!',
          backgroundMediaId: null
        })
        await s.services.addItem(sunday.id, { kind: 'song', songId: created[2].id })
        await s.live.loadService(sunday.id)
        // refrão no ar: o próximo slide (estrofe 2) fica em "Próximo"
        await s.live.goTo(first.id, 1)
      },
      { songs: SONGS, bgPath, sunsetPath, logoPath, biblePath }
    )

    const nav = (name: string) => win.getByRole('navigation').getByRole('button', { name, exact: true })

    // ---------- Operação sem culto escolhido (estado vazio) ----------
    await nav('Operação').click()
    await expect(win.getByText('Nenhum culto escolhido').first()).toBeVisible()
    await shot(win, '0-operacao-sem-culto.png')

    // ---------- Cultos (escolhe o culto de hoje) ----------
    await nav('Cultos').click()
    await win.getByRole('button', { name: /Culto de domingo/ }).click()
    await expect(win.getByText('Luz da manhã').first()).toBeVisible()
    await shot(win, '2-cultos.png')

    // diálogo de novo culto
    await win.getByRole('button', { name: 'Novo culto' }).click()
    await win.getByLabel('Nome').fill('Culto de Natal')
    await shot(win, '9-novo-culto.png')
    // clique fora não fecha o diálogo (não perde o que foi digitado)
    await win.mouse.click(1240, 760)
    await expect(win.getByLabel('Nome')).toHaveValue('Culto de Natal')
    await win.keyboard.press('Escape')
    await expect(win.getByRole('dialog')).toHaveCount(0)

    // ---------- Operação ----------
    await nav('Operação').click()
    await expect(win.locator('.tile--live')).toBeVisible()
    await shot(win, '1-operacao.png')

    // ---------- Músicas ----------
    await nav('Músicas').click()
    await win.getByRole('button', { name: /Luz da manhã/ }).click()
    await expect(win.getByLabel('Letra')).toBeVisible()
    await shot(win, '3-musicas.png')

    // ---------- Bíblia ----------
    await nav('Bíblia').click()
    await win.getByLabel('Referência').fill('Jo 3:1-5')
    await expect(win.locator('.passage')).toBeVisible()
    await win.getByRole('searchbox', { name: 'Buscar por palavra' }).fill('Jesus')
    await shot(win, '4-biblia.png')

    // ---------- Mídias ----------
    await nav('Mídias').click()
    await win.locator('.media-tile').nth(1).click()
    await shot(win, '5-midias.png')

    // ---------- Avisos ----------
    await nav('Avisos').click()
    await win.getByLabel('Título').fill('Ensaio do coral')
    await win.getByLabel('Texto do aviso').fill('Sábado, às 16h\nna sala de música')
    await shot(win, '6-avisos.png')

    // ---------- YouTube ----------
    await nav('YouTube').click()
    await win.waitForTimeout(1500)
    await shot(win, '7-youtube.png')

    // ---------- Configurações ----------
    await nav('Ajustes').click()
    await expect(win.getByRole('heading', { name: 'Aparência' })).toBeVisible()
    await shot(win, '8-configuracoes.png')
    await win.getByRole('navigation', { name: 'Seções' }).getByRole('button', { name: 'Aparência' }).click()
    await win.waitForTimeout(600)
    await shot(win, '8b-configuracoes-aparencia.png')

    // ---------- Operação com tela preta (tecla acesa) ----------
    await nav('Operação').click()
    await win.locator('body').click({ position: { x: 5, y: 5 } })
    await win.keyboard.press('b')
    await expect(win.locator('.ekey--on')).toBeVisible()
    await shot(win, '10-operacao-tela-preta.png')
    await win.keyboard.press('Escape')
  } finally {
    await app?.close()
    rmSync(userData, { recursive: true, force: true })
    rmSync(assets, { recursive: true, force: true })
  }
})
