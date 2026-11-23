import { pathToFileURL } from 'node:url'

/**
 * true se `url` é do próprio renderer do Sonora: a origem do servidor de desenvolvimento
 * (`devUrl`) ou um arquivo dentro de `rendererDir` (out/renderer) no app empacotado.
 * Qualquer outra coisa (arquivo solto na janela, link externo) não pode substituir a janela.
 */
export function isAppUrl(url: string, devUrl: string | null, rendererDir: string): boolean {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (devUrl) {
    try {
      return u.origin === new URL(devUrl).origin
    } catch {
      return false
    }
  }
  if (u.protocol !== 'file:') return false
  const base = pathToFileURL(rendererDir).href.replace(/\/?$/, '/')
  return `${u.protocol}//${u.host}${u.pathname}`.toLowerCase().startsWith(base.toLowerCase())
}
