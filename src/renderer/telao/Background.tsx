import type { Background as BackgroundData } from '../../shared/types'

export const mediaUrl = (id: string): string => `sonora-media://${id}`

const fill: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover'
}

export function Background({ background }: { background: BackgroundData }): JSX.Element {
  if (background.type === 'image' && background.mediaId) {
    return <img src={mediaUrl(background.mediaId)} style={fill} draggable={false} alt="" />
  }
  if (background.type === 'video' && background.mediaId) {
    return (
      <video
        key={background.mediaId}
        src={mediaUrl(background.mediaId)}
        style={fill}
        autoPlay
        loop
        muted
        playsInline
      />
    )
  }
  return <div style={{ position: 'absolute', inset: 0, background: background.color }} />
}
