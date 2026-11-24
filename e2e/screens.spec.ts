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

/** mapa de som de exemplo (3 canais) e a passagem de som */
const SOUND_MAP = {
  channels: [
    { id: 'ch-pastor', number: 1, name: 'Mic pastor', person: 'Pr. João', kind: 'wireless', notes: 'pilha trocada', inputIndex: 0 },
    { id: 'ch-violao', number: 2, name: 'Violão', person: 'Ana', kind: 'line', notes: '', inputIndex: 1 },
    { id: 'ch-vocal2', number: 3, name: 'Vocal 2', person: '', kind: 'wired', notes: '', inputIndex: null }
  ],
  checklist: [
    { id: 'ck-pilhas', text: 'Trocar pilhas dos microfones sem fio' },
    { id: 'ck-pulpito', text: 'Testar o microfone do púlpito' },
    { id: 'ck-retorno', text: 'Conferir o retorno do louvor' },
    { id: 'ck-gravacao', text: 'Ligar a gravação da pregação' }
  ]
}

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
      async ({ songs, bgPath, sunsetPath, logoPath, biblePath, SOUND_MAP }) => {
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
        // mapa de som do culto; o dispositivo salvo não existe (mesa desligada): a tela mostra o erro
        const map = await s.sound.create('Domingo')
        const saved = await s.sound.save({ ...map, ...SOUND_MAP })
        await s.sound.setForService(sunday.id, { mapId: saved.id, checked: saved.checklist.slice(0, 2).map((c: any) => c.id) })
        await s.settings.update({ soundInputDeviceId: 'mesa-usb-desligada' })
        await s.live.loadService(sunday.id)
        // refrão no ar: o próximo slide (estrofe 2) fica em "Próximo"
        await s.live.goTo(first.id, 1)
      },
      { songs: SONGS, bgPath, sunsetPath, logoPath, biblePath, SOUND_MAP }
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

    // ---------- Som (dispositivo ausente: estado de erro com ação) ----------
    await nav('Som').click()
    await expect(win.getByRole('textbox', { name: 'Canal 1' })).toHaveValue('Mic pastor')
    await expect(win.getByRole('alert').filter({ hasText: 'Dispositivo desconectado' })).toBeVisible()
    await expect(win.getByText('sem entrada')).toBeVisible()
    await shot(win, '11-som.png')
    // edição no lugar grava sozinha (500 ms) e marcar a passagem de som grava no culto
    await win.getByRole('textbox', { name: 'Quem 3' }).fill('Bia')
    await win.getByRole('checkbox', { name: /Conferir o retorno/ }).check()
    await expect
      .poll(() => win.evaluate(async () => (await (window as any).sonora.sound.list())[0].channels[2].person))
      .toBe('Bia')
    await expect
      .poll(() =>
        win.evaluate(async () => {
          const s = (window as any).sonora
          const sunday = (await s.services.list()).find((x: any) => x.name === 'Culto de domingo')
          return (await s.sound.getForService(sunday.id)).checked.length
        })
      )
      .toBe(3)

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

/**
 * WAV estéreo 48 kHz / 16 bits, 2 s em laço: entrada 1 com tom moderado (~-21 dB RMS),
 * entrada 2 com tom forte (~-5 dB RMS, faixa "alto"), para a captura mostrar os dois estados.
 */
function stereoWav(): Buffer {
  const rate = 48_000
  const frames = rate * 2
  const buf = Buffer.alloc(44 + frames * 4)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + frames * 4, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(2, 22)
  buf.writeUInt32LE(rate, 24)
  buf.writeUInt32LE(rate * 4, 28)
  buf.writeUInt16LE(4, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(frames * 4, 40)
  for (let i = 0; i < frames; i++) {
    const t = i / rate
    // leve variação de volume para o medidor se mexer
    const swell = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.5 * t)
    const left = 0.125 * swell * Math.sin(2 * Math.PI * 220 * t)
    const right = 0.8 * Math.sin(2 * Math.PI * 330 * t)
    buf.writeInt16LE(Math.round(left * 32767), 44 + i * 4)
    buf.writeInt16LE(Math.round(right * 32767), 46 + i * 4)
  }
  return buf
}

test('tela Som com medidores ao vivo (dispositivo de áudio falso do Chromium)', async () => {
  test.setTimeout(60_000)
  mkdirSync(shots, { recursive: true })
  const userData = mkdtempSync(join(tmpdir(), 'sonora-som-'))
  let app: ElectronApplication | undefined
  try {
    // só neste teste: o Chromium simula uma entrada de áudio estéreo lida de um WAV, sem placa de verdade
    const wav = join(userData, 'entrada-falsa.wav')
    writeFileSync(wav, stereoWav())
    app = await electron.launch({
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        `--use-file-for-fake-audio-capture=${wav}`,
        join(root, 'out/main/index.js')
      ],
      env: { ...process.env, SONORA_USER_DATA: userData }
    })
    const win = await app.firstWindow()
    await win.setViewportSize({ width: 1280, height: 800 })
    await win.waitForSelector('.rail')
    await win.evaluate(async (SOUND_MAP) => {
      const s = (window as any).sonora
      const map = await s.sound.create('Domingo')
      await s.sound.save({ ...map, ...SOUND_MAP })
    }, SOUND_MAP)

    await win.getByRole('navigation').getByRole('button', { name: 'Som', exact: true }).click()
    await expect(win.getByRole('textbox', { name: 'Canal 1' })).toHaveValue('Mic pastor')
    await expect(win.getByRole('status', { name: 'Estado da leitura' })).toContainText('Lendo', { timeout: 10_000 })
    // a entrada 1 recebe o tom de teste: o medidor sai do repouso
    await expect(win.locator('.ch-row').first().locator('.meter')).not.toHaveAttribute('data-look', 'idle')
    await win.waitForTimeout(800)
    await shot(win, '11b-som-ao-vivo.png')
  } finally {
    await app?.close()
    rmSync(userData, { recursive: true, force: true })
  }
})
