import { describe, expect, it } from 'vitest'
import { parseVideoId } from '../../src/shared/youtube'

describe('parseVideoId', () => {
  const id = 'dQw4w9WgXcQ'
  it('aceita watch?v=', () => {
    expect(parseVideoId(`https://www.youtube.com/watch?v=${id}`)).toBe(id)
    expect(parseVideoId(`https://youtube.com/watch?feature=share&v=${id}&t=10`)).toBe(id)
    expect(parseVideoId(`https://m.youtube.com/watch?v=${id}`)).toBe(id)
  })
  it('aceita youtu.be, embed e shorts', () => {
    expect(parseVideoId(`https://youtu.be/${id}?si=abc`)).toBe(id)
    expect(parseVideoId(`https://www.youtube.com/embed/${id}`)).toBe(id)
    expect(parseVideoId(`https://www.youtube.com/shorts/${id}`)).toBe(id)
  })
  it('aceita url sem protocolo e id puro', () => {
    expect(parseVideoId(`youtube.com/watch?v=${id}`)).toBe(id)
    expect(parseVideoId(`  ${id} `)).toBe(id)
    expect(parseVideoId('a-b_c1234XY')).toBe('a-b_c1234XY')
  })
  it('retorna null quando não há vídeo', () => {
    expect(parseVideoId('https://www.youtube.com/')).toBeNull()
    expect(parseVideoId('https://www.youtube.com/channel/UC1234567890')).toBeNull()
    expect(parseVideoId('https://www.youtube.com/watch?v=curto')).toBeNull()
    expect(parseVideoId('https://example.com/watch?v=' + id)).toBeNull()
    expect(parseVideoId('')).toBeNull()
    expect(parseVideoId('texto qualquer')).toBeNull()
  })
})
