import { describe, expect, it } from 'vitest'
import { guestMayNavigate, isYoutubeUrl, parseVideoId, youtubeGate, youtubeStatus } from '../../src/shared/youtube'

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

describe('guestMayNavigate', () => {
  it('aceita só hosts exatos do YouTube e do login do Google, em https', () => {
    for (const u of [
      'https://www.youtube.com/watch?v=x',
      'https://youtube.com/',
      'https://m.youtube.com/',
      'https://accounts.google.com/ServiceLogin',
      'https://accounts.youtube.com/accounts/SetSID',
      'https://consent.youtube.com/m',
      'https://consent.google.com/',
      'https://accounts.google.com.br/',
      'https://accounts.google.pt/'
    ])
      expect(guestMayNavigate(u), u).toBe(true)
  })
  it('recusa hosts parecidos, conteúdo de usuários e http', () => {
    for (const u of [
      'https://accounts.google.evil.com/',
      'https://accounts.google.co.de/',
      'https://sites.google.com/view/x',
      'https://youtube.com.evil.com/',
      'https://evil.com/youtube.com',
      'https://evil.com/?u=https://www.youtube.com/',
      'https://music.youtube.com/',
      'http://www.youtube.com/',
      'javascript:alert(1)',
      'lixo'
    ])
      expect(guestMayNavigate(u), u).toBe(false)
  })
})

describe('youtubeGate na página de watch', () => {
  const playing = { currentTime: 3, paused: false, adShowing: false, errorCode: null }
  it('erro não pede outro modo: só mantém invisível', () => {
    expect(youtubeGate({ ...playing, currentTime: 0, errorCode: 150 }, 'hidden', 'watch')).toBe('hidden')
    expect(youtubeGate({ ...playing, currentTime: 0, errorCode: 100 }, 'hidden', 'watch')).toBe('hidden')
  })
  it('vídeo tocando de verdade ignora tela de erro (falso positivo da página)', () => {
    expect(youtubeGate({ ...playing, errorCode: 150 }, 'hidden', 'watch')).toBe('visible')
  })
})

describe('youtubeStatus', () => {
  const s = { found: true, currentTime: 3, paused: false, adShowing: false, errorCode: null }
  it('sem amostra ou sem <video>: carregando', () => {
    expect(youtubeStatus(null, 'hidden', 'embed')).toBe('loading')
    expect(youtubeStatus({ ...s, found: false, currentTime: 0 }, 'hidden', 'embed')).toBe('loading')
  })
  it('anúncio', () => {
    expect(youtubeStatus({ ...s, adShowing: true }, 'hidden', 'embed')).toBe('ad')
  })
  it('tocando e pausado', () => {
    expect(youtubeStatus(s, 'visible', 'embed')).toBe('playing')
    expect(youtubeStatus({ ...s, paused: true }, 'visible', 'embed')).toBe('paused')
    expect(youtubeStatus({ ...s, paused: true, currentTime: 0 }, 'hidden', 'embed')).toBe('paused')
  })
  it('tocando mas portão ainda fechado: carregando', () => {
    expect(youtubeStatus({ ...s, currentTime: 0 }, 'hidden', 'embed')).toBe('loading')
  })
  it('embed recusado vai para a página de watch: carregando, não erro', () => {
    expect(youtubeStatus({ ...s, errorCode: 150 }, 'hidden', 'embed')).toBe('loading')
  })
  it('outros erros no embed e qualquer erro na página de watch: erro', () => {
    expect(youtubeStatus({ ...s, errorCode: 100 }, 'hidden', 'embed')).toBe('error')
    expect(youtubeStatus({ ...s, found: false, currentTime: 0, errorCode: 150 }, 'hidden', 'watch')).toBe('error')
  })
  it('na página de watch, vídeo tocando ignora tela de erro', () => {
    expect(youtubeStatus({ ...s, errorCode: 150 }, 'visible', 'watch')).toBe('playing')
  })
})
