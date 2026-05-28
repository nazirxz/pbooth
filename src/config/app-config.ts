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
    // In production builds, default to 'doku' — silently falling back to
    // 'mock' (which auto-resolves in 3 s) is a critical safety bug, since
    // it would let customers skip payment entirely if the env var was
    // dropped during deploy. In dev builds, default to 'mock' so offline
    // UI work doesn't require a Supabase round-trip.
    provider: (
      import.meta.env.VITE_PAYMENT_PROVIDER ??
      (import.meta.env.PROD ? 'doku' : 'mock')
    ) as 'mock' | 'doku',
    amount: 30_000,
    currency: 'IDR',
    timeoutSec: 300,
    // Show "DEV: SIMULATE PAID" only in Vite dev mode (`npm run dev`).
    // Production builds (`npm run build`) baked import.meta.env.DEV=false,
    // so this resolves to false and the button never renders. Belt-and-
    // suspenders: the dev-simulate-paid edge function is also locked when
    // DOKU_ENV=production server-side.
    devSkipButton: import.meta.env.DEV,
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

// ── startup diagnostics ────────────────────────────────────────────────────
// Log the active config so DevTools immediately shows which payment
// provider and Vite mode the build is running with. Catches the worst
// silent bug — a production deploy that fell back to the mock provider.
if (typeof console !== 'undefined') {
  const tag = '[Pbooth]'
  const mode = import.meta.env.MODE
  const provider = appConfig.payment.provider
  const supabaseSet = !!appConfig.supabase.url && !!appConfig.supabase.anonKey

  console.info(
    `${tag} mode=${mode} provider=${provider} supabaseConfigured=${supabaseSet}`,
  )
  if (import.meta.env.PROD && provider === 'mock') {
    console.error(
      `${tag} CRITICAL: production build with MOCK payment provider — ` +
        'customers can skip payment! Set VITE_PAYMENT_PROVIDER=doku in .env.production.',
    )
  }
  if (provider === 'doku' && !supabaseSet) {
    console.error(
      `${tag} DOKU provider selected but Supabase env vars are missing — ` +
        'create-doku-payment edge function cannot be reached.',
    )
  }
}
