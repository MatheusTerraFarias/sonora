import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import pngToIco from 'png-to-ico'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const svg = readFileSync(resolve(root, 'brand/logo/icone-app.svg'))
const out = resolve(root, 'build')
mkdirSync(out, { recursive: true })

const render = (size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

writeFileSync(resolve(out, 'icon.png'), render(512))
const sizes = [16, 24, 32, 48, 64, 128, 256]
writeFileSync(resolve(out, 'icon.ico'), await pngToIco(sizes.map(render)))
console.log('build/icon.png e build/icon.ico gerados')
