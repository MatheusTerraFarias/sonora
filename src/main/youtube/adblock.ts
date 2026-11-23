import { app, net, session } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ElectronBlocker } from '@ghostery/adblocker-electron'
import { YOUTUBE_PARTITION } from '../../shared/youtube'

// Só é importado (import() dinâmico) quando __ADBLOCK__ é true; com SONORA_ADBLOCK=0 fica fora do bundle.

let blocker: Promise<ElectronBlocker> | null = null
let queue: Promise<void> = Promise.resolve()

/** listas pré-compiladas do Ghostery, em cache em <userData>/adblock-cache.bin */
function load(): Promise<ElectronBlocker> {
  if (!blocker) {
    blocker = ElectronBlocker.fromPrebuiltAdsAndTracking((url: string) => net.fetch(url), {
      path: join(app.getPath('userData'), 'adblock-cache.bin'),
      read: (p) => readFile(p),
      write: (p, buf) => writeFile(p, buf)
    })
    // sem internet na primeira vez e sem cache: tenta de novo na próxima chamada
    blocker.catch(() => {
      blocker = null
    })
  }
  return blocker
}

/**
 * Liga/desliga o bloqueador na sessão do YouTube. Nunca rejeita: se as listas não
 * puderem ser carregadas, registra e segue sem bloqueador (a reprodução não para).
 */
export function setAdblock(enabled: boolean): Promise<void> {
  queue = queue.then(async () => {
    const ses = session.fromPartition(YOUTUBE_PARTITION)
    try {
      if (enabled) {
        const b = await load()
        if (!b.isBlockingEnabled(ses)) b.enableBlockingInSession(ses)
      } else if (blocker) {
        const b = await blocker
        if (b.isBlockingEnabled(ses)) b.disableBlockingInSession(ses)
      }
    } catch (err) {
      console.warn('[sonora] bloqueador de anúncios indisponível:', err)
    }
  })
  return queue
}
