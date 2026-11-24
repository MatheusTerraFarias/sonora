/** Páginas do YouTube (webview) só podem pedir tela cheia; microfone, câmera, notificações etc. são negados. */
export function allowYoutubePermission(permission: string): boolean {
  return permission === 'fullscreen'
}
