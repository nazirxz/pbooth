import { create } from 'zustand'

export interface PlacedSticker {
  /** Instance id (unique per placement). */
  id: string
  /** Sticker asset id from STICKERS. */
  assetId: string
  /** Position as fraction of strip (0-1). */
  x: number
  y: number
  /** Size multiplier (1.0 = base). */
  scale: number
  rotation: number
}

interface DecorationState {
  borderId: string           // one of BORDERS ids
  stickers: PlacedSticker[]
  selectedStickerId: string | null

  setBorder: (id: string) => void
  addSticker: (assetId: string, x?: number, y?: number) => void
  moveSticker: (id: string, x: number, y: number) => void
  setStickerScale: (id: string, scale: number) => void
  removeSticker: (id: string) => void
  selectSticker: (id: string | null) => void
  clearStickers: () => void
  reset: (borderId?: string) => void
}

let counter = 0
function nextStickerId() {
  counter += 1
  return `sk_${Date.now().toString(36)}_${counter}`
}

export const useDecoration = create<DecorationState>((set) => ({
  borderId: 'classic-black',
  stickers: [],
  selectedStickerId: null,

  setBorder: (borderId) => set({ borderId }),

  addSticker: (assetId, x, y) =>
    set((s) => ({
      stickers: [
        ...s.stickers,
        {
          id: nextStickerId(),
          assetId,
          x: x ?? 0.5 + (Math.random() - 0.5) * 0.1,
          y: y ?? 0.1 + Math.random() * 0.8,
          scale: 1,
          rotation: 0,
        },
      ],
    })),

  moveSticker: (id, x, y) =>
    set((s) => ({
      stickers: s.stickers.map((sk) => (sk.id === id ? { ...sk, x, y } : sk)),
    })),

  setStickerScale: (id, scale) =>
    set((s) => ({
      stickers: s.stickers.map((sk) => (sk.id === id ? { ...sk, scale } : sk)),
    })),

  removeSticker: (id) =>
    set((s) => ({
      stickers: s.stickers.filter((sk) => sk.id !== id),
      selectedStickerId: s.selectedStickerId === id ? null : s.selectedStickerId,
    })),

  selectSticker: (selectedStickerId) => set({ selectedStickerId }),

  clearStickers: () => set({ stickers: [], selectedStickerId: null }),

  reset: (borderId = 'classic-black') =>
    set({ borderId, stickers: [], selectedStickerId: null }),
}))
