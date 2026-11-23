/** Métodos da <webview> do Electron usados pelo Sonora (o tipo do React só cobre os atributos). */
export interface WebviewElement extends HTMLElement {
  executeJavaScript(code: string): Promise<unknown>
  insertCSS(css: string): Promise<string>
  loadURL(url: string): Promise<void>
  reload(): void
  getURL(): string
  getTitle(): string
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
}
