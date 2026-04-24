/**
 * Sticker library. Each sticker is rendered as a Unicode glyph (emoji or
 * symbol) drawn with a colored text fill. This keeps the bundle tiny while
 * still giving us a big palette that's friendly on touchscreens.
 */

export interface StickerDef {
  id: string
  glyph: string
  name: string
  color?: string
  /** Relative size multiplier vs base (1.0 = 64px on strip canvas). */
  scale?: number
}

export const STICKERS: StickerDef[] = [
  { id: 'heart-pink', glyph: '♥', name: 'HEART', color: '#ff4fa1' },
  { id: 'heart-outline', glyph: '♡', name: 'LOVE', color: '#ff4fa1' },
  { id: 'sparkle-gold', glyph: '✦', name: 'SPARKLE', color: '#ffbe0b' },
  { id: 'sparkle-pink', glyph: '✧', name: 'TWINKLE', color: '#ff7ac4' },
  { id: 'star-fill', glyph: '★', name: 'STAR', color: '#ffd60a' },
  { id: 'star-outline', glyph: '☆', name: 'STAR*', color: '#ff4fa1' },
  { id: 'flower', glyph: '✿', name: 'BLOOM', color: '#ff4fa1' },
  { id: 'flower2', glyph: '❀', name: 'DAISY', color: '#ffbe0b' },
  { id: 'snow', glyph: '❄', name: 'SNOW', color: '#00e5ff' },
  { id: 'cloud', glyph: '☁', name: 'CLOUD', color: '#b17cff' },
  { id: 'sun', glyph: '☼', name: 'SUN', color: '#ffbe0b' },
  { id: 'music', glyph: '♫', name: 'MUSIC', color: '#ff4fa1' },
  { id: 'lightning', glyph: '⚡', name: 'ZAP', color: '#ffd60a' },
  { id: 'peace', glyph: '☮', name: 'PEACE', color: '#2fbf71' },
  { id: 'smile', glyph: '☺', name: 'SMILE', color: '#ffbe0b' },
  { id: 'yin-yang', glyph: '☯', name: 'YIN', color: '#1a1412' },
  { id: 'diamond', glyph: '◆', name: 'GEM', color: '#00e5ff' },
  { id: 'sakura', glyph: '🌸', name: 'SAKURA' },
  { id: 'butterfly', glyph: '🦋', name: 'BFLY' },
  { id: 'strawberry', glyph: '🍓', name: 'BERRY' },
  { id: 'rainbow', glyph: '🌈', name: 'RAINBOW' },
  { id: 'boom', glyph: '💥', name: 'BOOM' },
  { id: 'hearteye', glyph: '💖', name: 'LOVE+' },
  { id: 'stars', glyph: '💫', name: 'DIZZY' },
]

export function getSticker(id: string): StickerDef | undefined {
  return STICKERS.find((s) => s.id === id)
}
