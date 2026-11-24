import { expect, test } from 'vitest'
import { allowYoutubePermission } from '../../src/main/youtube/permissions'

test('só tela cheia é permitida ao YouTube', () => {
  expect(allowYoutubePermission('fullscreen')).toBe(true)
  for (const p of ['media', 'notifications', 'geolocation', 'clipboard-read', 'midi', 'openExternal'])
    expect(allowYoutubePermission(p)).toBe(false)
})
