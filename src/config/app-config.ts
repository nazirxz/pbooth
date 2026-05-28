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
    // Number of shots per session is driven by the selected template's `frames`,
    // not a global config — so picking TRIO captures 3, DUO captures 2, etc.
    countdownSec: 3,
    delayBetweenFramesMs: 800,
  },
  payment: {
    enabled: true,
    provider: (import.meta.env.VITE_PAYMENT_PROVIDER ?? 'mock') as
      | 'mock'
      | 'doku',
    amount: 30_000,
    currency: 'IDR',
    timeoutSec: 300,
    devSkipButton: true,
    mockAutoResolveMs: 3_000,
    doku: {
      // Optional override for the create-doku-payment edge function URL.
      // When unset, the provider derives it from VITE_SUPABASE_URL.
      createUrl: (import.meta.env.VITE_DOKU_CREATE_URL ?? '').replace(/\/$/, ''),
    },
  },
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL ?? '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
    photosBucket: 'photos',
    composedBucket: 'composed',
  },
  share: {
    // Public URL where the share page is deployed (e.g. https://pbooth.vercel.app).
    // The kiosk runs in Electron — window.location.origin there is `file://` and
    // unreachable from a customer's phone, so the QR must point at this domain.
    baseUrl: (import.meta.env.VITE_SHARE_BASE_URL ?? '').replace(/\/$/, ''),
  },
  templates: [
    { id: 'duo-2', label: 'DUO', frames: 2, layout: 'vertical' },
    { id: 'strip-3', label: 'TRIO', frames: 3, layout: 'vertical' },
    { id: 'strip-4', label: 'CLASSIC STRIP', frames: 4, layout: 'vertical' },
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
