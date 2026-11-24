import type { YoutubeStatus } from './youtube';

export type ID = string;

export interface SongPart {
  id: ID;
  label: string;
  slides: string[];
}

export type SongAttachment =
  | { kind: 'youtube'; videoId: string; title: string }
  | { kind: 'media'; mediaId: ID }
  | null;

export interface Song {
  id: ID;
  title: string;
  artist: string;
  key: string | null;
  tags: string[];
  parts: SongPart[];
  arrangement: ID[];
  attachment: SongAttachment;
  createdAt: string;
  updatedAt: string;
}

export type MediaKind = 'image' | 'video' | 'audio';

export interface MediaItem {
  id: ID;
  kind: MediaKind;
  originalName: string;
  fileName: string;
  mime: string;
}

export type ServiceItemData =
  | { kind: 'song'; songId: ID }
  | { kind: 'bible'; ref: string; translation: string }
  | { kind: 'media'; mediaId: ID }
  | { kind: 'youtube'; videoId: string; title: string; thumbnail: string }
  | { kind: 'notice'; title: string; body: string; backgroundMediaId: ID | null };

export interface ServiceItem {
  id: ID;
  serviceId: ID;
  position: number;
  data: ServiceItemData;
}

export interface Service {
  id: ID;
  name: string;
  date: string;
  items: ServiceItem[];
}

/** Item de culto resolvido para exibição (ex.: música resolvida a partir de songId). */
export interface ResolvedItem {
  item: ServiceItem;
  missing: boolean;
  title: string;
}

export interface Slide {
  label: string;
  text: string;
  /** rodapé (ex.: "João 3:16") */
  title?: string;
}

export type LiveContent =
  | { type: 'slide'; slide: Slide }
  | { type: 'media'; media: MediaItem; playing: boolean; volume: number; position: number; seek?: number }
  | { type: 'youtube'; videoId: string; playing: boolean; volume: number; position: number; seek?: number }
  | { type: 'none' };
// `position` é o pedido de posição do operador; `seek` muda a cada pedido (o mesmo valor pode ser pedido de novo)

/** progresso real da reprodução, informado pelo telão (~4 Hz); `key` = id da mídia ou do vídeo */
export interface LiveProgress {
  key: string;
  position: number;
  duration: number;
  /** só YouTube: estado do portão do telão (mídia local não envia) */
  status?: YoutubeStatus;
}

/** clear = esconde texto, mantém fundo */
export type Overlay = 'none' | 'clear' | 'black' | 'logo';

export interface Background {
  type: 'color' | 'image' | 'video';
  color: string;
  mediaId: ID | null;
}

export interface TextStyle {
  fontFamily: string;
  maxFontPx: number;
  minFontPx: number;
  color: string;
  shadow: boolean;
  align: 'left' | 'center' | 'right';
}

export interface LiveState {
  content: LiveContent;
  overlay: Overlay;
  background: Background;
  style: TextStyle;
  logoMediaId: ID | null;
  /**
   * `gap`: o item ao vivo foi removido do culto; posição que ele ocupava (avançar/voltar continuam dali).
   * O telão mantém o conteúdo até o operador navegar.
   */
  cursor: { itemId: ID | null; slideIndex: number; gap?: number };
}

export interface Settings {
  churchName: string;
  logoMediaId: ID | null;
  projectionDisplayId: number | null;
  background: Background;
  style: TextStyle;
  audioOutputDeviceId: string | null;
  adblockEnabled: boolean;
  updatesEnabled: boolean;
  /** dispositivo de entrada de áudio do monitoramento de som; null = padrão do sistema */
  soundInputDeviceId: string | null;
}
