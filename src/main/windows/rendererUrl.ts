export function rendererUrl(page: 'operator' | 'telao'): string | null {
  const base = process.env['ELECTRON_RENDERER_URL']
  return base ? `${base}/${page}/index.html` : null
}
