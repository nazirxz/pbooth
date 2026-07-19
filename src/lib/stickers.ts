/** Sticker assets discovered automatically from src/asset/stickers. */

export interface StickerDef {
  id: string
  name: string
  src: string
}

const stickerModules = import.meta.glob<string>('/src/asset/stickers/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
})

function stickerNumber(path: string): number {
  const match = path.match(/sticker(\d+)\.png$/i)
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER
}

export const STICKERS: StickerDef[] = Object.entries(stickerModules)
  .sort(([pathA], [pathB]) => stickerNumber(pathA) - stickerNumber(pathB))
  .map(([path, src]) => {
    const filename = path.split('/').pop() ?? path
    const id = filename.replace(/\.png$/i, '')
    return {
      id,
      name: id.replace(/(\d+)$/, ' $1').toUpperCase(),
      src,
    }
  })

export function getSticker(id: string): StickerDef | undefined {
  return STICKERS.find((sticker) => sticker.id === id)
}
