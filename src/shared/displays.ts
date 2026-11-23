export interface DisplayInfo {
  id: number
  label: string
  primary: boolean
  isOperator: boolean
}

/**
 * Escolhe o monitor do telão. Nunca devolve o monitor do operador.
 * `null` quando não há outro monitor.
 */
export function pickProjectionDisplay(
  displays: { id: number; primary: boolean }[],
  savedId: number | null,
  operatorDisplayId: number
): number | null {
  if (savedId !== null && savedId !== operatorDisplayId && displays.some((d) => d.id === savedId)) return savedId
  const other = displays.find((d) => d.id !== operatorDisplayId)
  return other ? other.id : null
}
