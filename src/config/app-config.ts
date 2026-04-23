export const appConfig = {
  app: {
    name: 'Pbooth',
    idleResetMs: 60_000,
  },
  viewport: {
    width: 1920,
    height: 1080,
    orientation: 'landscape' as const,
  },
  camera: {
    source: 'webcam' as 'webcam' | 'dslr',
    webcam: {
      facingMode: 'user',
      width: 1280,
      height: 960,
    },
  },
  capture: {
    frameCount: 4,
    countdownSec: 3,
    delayBetweenFramesMs: 800,
  },
  payment: {
    enabled: true,
    provider: 'mock' as 'mock' | 'qris' | 'midtrans',
    amount: 15_000,
    currency: 'IDR',
    timeoutSec: 300,
    devSkipButton: true,
    mockAutoResolveMs: 3_000,
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL ?? '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    photosBucket: 'photos',
    composedBucket: 'composed',
  },
  templates: [
    { id: 'strip-4', label: 'CLASSIC STRIP', frames: 4, layout: 'vertical' },
    { id: 'strip-3', label: 'TRIO', frames: 3, layout: 'vertical' },
    { id: 'grid-2x2', label: 'QUAD', frames: 4, layout: 'grid' },
  ],
  filters: [
    { id: 'none', label: 'NORMAL' },
    { id: 'bw-grain', label: 'B&W GRAIN' },
    { id: 'sepia', label: 'SEPIA' },
    { id: 'vhs', label: 'VHS' },
    { id: 'neon-80s', label: '80s NEON' },
    { id: 'polaroid', label: 'POLAROID' },
  ],
} as const

export type TemplateId = (typeof appConfig.templates)[number]['id']
export type FilterId = (typeof appConfig.filters)[number]['id']
