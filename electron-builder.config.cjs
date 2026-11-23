/**
 * Configuração do instalador. Com SONORA_ADBLOCK=0 o bloqueador de anúncios
 * (@ghostery/*) não entra no pacote; é a mesma variável que remove o código
 * em electron.vite.config.ts.
 */
const withAdblock = process.env.SONORA_ADBLOCK !== '0'

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'app.sonora.desktop',
  productName: 'Sonora',
  directories: { buildResources: 'build', output: 'dist' },
  files: [
    'out/**',
    'package.json',
    // só o binário do Windows x64 é usado
    '!node_modules/better-sqlite3/prebuilds/{darwin,linux,linuxmusl}-*.node',
    '!node_modules/better-sqlite3/prebuilds/win32-arm64.node',
    ...(withAdblock ? [] : ['!node_modules/@ghostery/**'])
  ],
  extraResources: [{ from: 'resources/bible', to: 'bible' }],
  // o módulo nativo já é instalado para o Electron pelo postinstall (prebuilt); recompilar exigiria o Visual Studio
  npmRebuild: false,
  asarUnpack: ['node_modules/better-sqlite3/**'],
  win: { target: 'nsis', icon: 'build/icon.ico' },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    // os dados do usuário ficam em userData: nunca apagados ao desinstalar ou atualizar
    deleteAppDataOnUninstall: false,
    artifactName: 'Sonora-Setup-${version}.${ext}'
  },
  // dono/repositório ficam para quando o autor decidir onde publicar
  publish: { provider: 'github' }
}
