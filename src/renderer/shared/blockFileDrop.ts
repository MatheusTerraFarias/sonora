/**
 * Soltar um arquivo na janela faria o Chromium navegar até ele (a janela do operador ou o
 * telão seriam substituídos). Cancela arrastar/soltar no documento inteiro. Um componente
 * que trate drop de verdade recebe o evento antes (fase de borbulha chega ao document por
 * último) e funciona normalmente. O main também bloqueia a navigação (guardAppNavigation).
 */
export function blockFileDrop(): void {
  const cancel = (e: DragEvent): void => e.preventDefault()
  document.addEventListener('dragover', cancel)
  document.addEventListener('drop', cancel)
}
