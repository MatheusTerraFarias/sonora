export interface MediaPermissionQuery {
  permission: string
  /** id do webContents que pede; null se desconhecido */
  requesterId: number | null
  /** id do webContents da janela do operador; null se ainda não existe */
  operatorId: number | null
  /** pedido (setPermissionRequestHandler): lista de tipos */
  mediaTypes?: string[]
  /** verificação (setPermissionCheckHandler): 'audio' | 'video' | 'unknown' */
  mediaType?: string
}

/**
 * Microfone/entrada de áudio só para a janela do operador (tela Som), nunca vídeo.
 * O telão, as webviews e qualquer outra coisa continuam negados.
 */
export function allowMediaPermission(q: MediaPermissionQuery): boolean {
  if (q.permission !== 'media') return false
  if (q.requesterId === null || q.operatorId === null || q.requesterId !== q.operatorId) return false
  if (q.mediaTypes?.includes('video')) return false
  if (q.mediaType === 'video') return false
  return true
}
