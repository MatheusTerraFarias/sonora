export interface MediaPermissionQuery {
  permission: string
  /** id do webContents que pede; null se desconhecido */
  requesterId: number | null
  /** id do webContents da janela do operador; null se ainda não existe */
  operatorId: number | null
  /** id do webContents do telão; null/ausente se não há telão */
  projectionId?: number | null
  /** true na VERIFICAÇÃO (setPermissionCheckHandler); false/ausente no PEDIDO (setPermissionRequestHandler) */
  check?: boolean
  /** pedido (setPermissionRequestHandler): lista de tipos */
  mediaTypes?: string[]
  /** verificação (setPermissionCheckHandler): 'audio' | 'video' | 'unknown' */
  mediaType?: string
}

/**
 * Sessão padrão (operador + telão). Antes da tela Som ela concedia tudo implicitamente (sem
 * handlers); o app só usa DUAS coisas dela, e só estas ficam liberadas:
 *  - operador: `media` de áudio (getUserMedia dos medidores + listar dispositivos), nunca vídeo;
 *  - telão: na VERIFICAÇÃO (nunca no pedido), `media` de áudio/desconhecido e `speaker-selection`,
 *    que o Chromium consulta para autorizar HTMLMediaElement.setSinkId (saída de áudio escolhida).
 *    Uma verificação não abre captura nenhuma, então liberar não expõe microfone.
 * Nada mais é usado (geolocalização, notificações, MIDI, sensores, clipboard...; tela cheia do
 * telão é feita pelo BrowserWindow, não por permissão; o YouTube roda em webviews de sessão própria).
 */
export function allowMediaPermission(q: MediaPermissionQuery): boolean {
  if (q.requesterId === null) return false
  const isOperator = q.operatorId !== null && q.requesterId === q.operatorId
  const isProjection = q.projectionId != null && q.requesterId === q.projectionId
  if (q.permission === 'speaker-selection') return isOperator || isProjection
  if (q.permission !== 'media') return false
  if (q.mediaTypes?.includes('video')) return false
  if (q.mediaType === 'video') return false
  if (isOperator) return true
  // telão: só verificação (setSinkId); getUserMedia dele continua negado
  return isProjection && q.check === true
}
