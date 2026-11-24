import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  churchName: '',
  logoMediaId: null,
  projectionDisplayId: null,
  background: { type: 'color', color: '#09124F', mediaId: null },
  style: {
    fontFamily: 'Sora',
    maxFontPx: 96,
    minFontPx: 32,
    color: '#FFFFFF',
    shadow: true,
    align: 'center',
  },
  audioOutputDeviceId: null,
  adblockEnabled: false,
  updatesEnabled: false,
  soundInputDeviceId: null,
};
