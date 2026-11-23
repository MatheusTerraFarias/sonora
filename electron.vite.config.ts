import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/** SONORA_ADBLOCK=0 gera um build sem o bloqueador de anúncios */
const define = { __ADBLOCK__: JSON.stringify(process.env.SONORA_ADBLOCK !== '0') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    define
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          operator: resolve(__dirname, 'src/renderer/operator/index.html'),
          telao: resolve(__dirname, 'src/renderer/telao/index.html')
        }
      }
    }
  }
})
