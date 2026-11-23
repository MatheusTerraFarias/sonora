import { protocol, net } from 'electron'
import { pathToFileURL } from 'node:url'

export const MEDIA_SCHEME = 'sonora-media'

const REQUEST = /^sonora-media:\/\/([a-z0-9-]+)\/?(?:[?#].*)?$/i

/**
 * Resolve `sonora-media://<id>` para o caminho do arquivo. Só ids são aceitos
 * (nada de caminhos), então não há como sair de mediaDir. null => 404.
 */
export function resolveMediaRequest(url: string, repo: { filePath(id: string): string | null }): string | null {
  const m = REQUEST.exec(url)
  return m ? repo.filePath(m[1].toLowerCase()) : null
}

/** Deve ser chamado antes de `app.whenReady()`. */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: MEDIA_SCHEME, privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
  ])
}

/** Deve ser chamado após `app.whenReady()`. net.fetch de file:// atende Range. */
export function handleMediaProtocol(repo: { filePath(id: string): string | null }): void {
  protocol.handle(MEDIA_SCHEME, (request) => {
    const path = resolveMediaRequest(request.url, repo)
    if (!path) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(path).toString(), {
      headers: request.headers,
      method: request.method
    })
  })
}
