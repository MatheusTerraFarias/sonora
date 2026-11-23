import { describe, expect, it } from 'vitest'
import { isYoutubeUrl, parseVideoId, youtubeGate } from '../../src/shared/youtube'

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

describe('youtubeGate', () => {
  const playing = { currentTime: 3, paused: false, adShowing: false, errorCode: null }
  it('fica invisível enquanto o vídeo não está tocando de verdade', () => {
    expect(youtubeGate({ ...playing, currentTime: 0 })).toBe('hidden')
    expect(youtubeGate({ ...playing, paused: true })).toBe('hidden')
    expect(youtubeGate({ ...playing, currentTime: 0, paused: true })).toBe('hidden')
  })
  it('fica invisível durante anúncio, mesmo tocando', () => {
    expect(youtubeGate({ ...playing, adShowing: true })).toBe('hidden')
    expect(youtubeGate({ ...playing, adShowing: true }, 'visible')).toBe('hidden')
  })
  it('mostra quando o conteúdo está tocando', () => {
    expect(youtubeGate(playing)).toBe('visible')
    expect(youtubeGate(playing, 'hidden')).toBe('visible')
  })
  it('pausa pedida depois de visível mantém o quadro (não volta ao slide anterior)', () => {
    expect(youtubeGate({ ...playing, paused: true }, 'visible')).toBe('visible')
    expect(youtubeGate({ ...playing, paused: true, currentTime: 0 }, 'visible')).toBe('hidden')
  })
  it('erros 101/150 (incorporação proibida) pedem o modo alternativo', () => {
    expect(youtubeGate({ ...playing, errorCode: 101 })).toBe('fallback')
    expect(youtubeGate({ ...playing, errorCode: 150 }, 'visible')).toBe('fallback')
  })
  it('erro 153 (embed recusado por configuração/referência) também pede o modo alternativo', () => {
    expect(youtubeGate({ ...playing, currentTime: 0, errorCode: 153 })).toBe('fallback')
  })
  it('outros erros mantêm invisível', () => {
    expect(youtubeGate({ ...playing, errorCode: 100 })).toBe('hidden')
    expect(youtubeGate({ ...playing, errorCode: 5 }, 'visible')).toBe('hidden')
  })
})

describe('isYoutubeUrl', () => {
  it('aceita só https nos hosts do YouTube', () => {
    expect(isYoutubeUrl('https://www.youtube.com/')).toBe(true)
    expect(isYoutubeUrl('https://youtube.com/watch?v=x')).toBe(true)
    expect(isYoutubeUrl('https://m.youtube.com/')).toBe(true)
    expect(isYoutubeUrl('http://www.youtube.com/')).toBe(false)
    expect(isYoutubeUrl('https://www.youtube.com.evil.com/')).toBe(false)
    expect(isYoutubeUrl('https://evil.com/?https://www.youtube.com/')).toBe(false)
    expect(isYoutubeUrl('file:///c:/x')).toBe(false)
    expect(isYoutubeUrl('lixo')).toBe(false)
  })
})
