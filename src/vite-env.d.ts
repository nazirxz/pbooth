/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SHARE_BASE_URL?: string
  readonly VITE_PAYMENT_PROVIDER?: 'mock' | 'doku'
  readonly VITE_DOKU_CREATE_URL?: string
  readonly VITE_DEV_SKIP_BUTTON?: string
  readonly VITE_CAPTURE_COUNTDOWN_SEC?: string
  readonly VITE_PRINTER_SILENT?: string
  readonly VITE_DCC_CAPTURE_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  pbooth?: {
    quit: () => Promise<void>
    version: () => Promise<string>
    print: (
      dataUrl: string,
      opts?: {
        deviceName?: string
        silent?: boolean
        landscape?: boolean
        rotation?: number
      }
    ) => Promise<void>
  }
}

declare module '*.jpeg' {
  const src: string
  export default src
}
declare module '*.jpg' {
  const src: string
  export default src
}
declare module '*.png' {
  const src: string
  export default src
}
declare module '*.svg' {
  const src: string
  export default src
}

// Minimal types for `gifenc` (no @types package published).
// Covers only the surface we touch in src/lib/gif-encoder.ts.
declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: {
        palette?: number[][]
        delay?: number
        transparent?: boolean
        transparentIndex?: number
        dispose?: number
        repeat?: number
        first?: boolean
      },
    ): void
    finish(): void
    bytes(): Uint8Array
    bytesView(): Uint8Array
    reset(): void
  }
  export function GIFEncoder(opts?: { auto?: boolean; initialCapacity?: number }): GIFEncoderInstance
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    opts?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; clearAlpha?: boolean; clearAlphaThreshold?: number; oneBitAlpha?: boolean | number },
  ): number[][]
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array
  export function nearestColorIndex(palette: number[][], pixel: number[]): number
  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    opts?: { roundRGB?: number; roundAlpha?: number; oneBitAlpha?: boolean | number },
  ): void
}
