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
    // 'webcam' = laptop/USB webcam (PoC, dev).
    // 'dslr'   = Canon EOS via digiCamControl HTTP API for tethered capture
    //            (manual mode + on-body flash), HDMI capture card for live preview.
    source: (import.meta.env.VITE_CAMERA_SOURCE ?? 'webcam') as 'webcam' | 'dslr',
    webcam: {
      facingMode: 'user',
      width: 1280,
      height: 960,
    },
    dslr: {
      /**
       * digiCamControl HTTP API endpoint. Default port from the installer.
       * Enable "Web server" in digiCamControl: File → Settings → Webserver.
       */
      apiUrl: (import.meta.env.VITE_DCC_URL ?? 'http://localhost:5513').replace(/\/$/, ''),
      /**
       * Manual shooting parameters applied to the camera before each capture.
       * Strings match digiCamControl's expected property values (camera-dependent).
       * Override per kiosk via env vars when lighting differs.
       */
      capture: {
        iso: import.meta.env.VITE_DCC_ISO ?? '400',
        shutter: import.meta.env.VITE_DCC_SHUTTER ?? '1/125',
        aperture: import.meta.env.VITE_DCC_APERTURE ?? '5.6',
      },
      /**
       * If digiCamControl is unreachable on start (dev machine without rig),
       * fall back silently to the webcam pipeline so UI work is unblocked.
       * Set false in production to fail loudly instead.
       */
      fallbackToWebcam: import.meta.env.VITE_DCC_FALLBACK !== 'false',
      /** Polling timeout for the file-ready check after a capture, in ms. */
      captureTimeoutMs: 8_000,
    },
  },
  capture: {
    // Number of shots per session is driven by the selected template's `frames`,
    // not a global config — so picking TRIO captures 3, DUO captures 2, etc.
    countdownSec: 5,
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
    amount: 37_000,
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
  storage: {
    backend: (import.meta.env.VITE_STORAGE_BACKEND ?? 'supabase') as 'supabase' | 'r2',
  },
  r2: {
    accountId: import.meta.env.VITE_R2_ACCOUNT_ID ?? '',
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY ?? '',
    bucketName: import.meta.env.VITE_R2_BUCKET_NAME ?? 'pbooth-photos',
    endpoint: import.meta.env.VITE_R2_ACCOUNT_ID
      ? `https://${import.meta.env.VITE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : '',
    publicUrl: import.meta.env.VITE_R2_PUBLIC_URL ?? '',
    region: 'auto',
  },
  share: {
    // Public URL where the share page is deployed (e.g. https://pbooth.vercel.app).
    // The kiosk runs in Electron — window.location.origin there is `file://` and
    // unreachable from a customer's phone, so the QR must point at this domain.
    baseUrl: (import.meta.env.VITE_SHARE_BASE_URL ?? '').replace(/\/$/, ''),
  },
  printer: {
    enabled: true,
    // Device name as it appears in Windows printer list. Leave empty to use
    // the system default printer. DNP printers typically show as "DNP DS620"
    // or similar — check Control Panel → Devices and Printers for exact name.
    deviceName: 'DNP',
    // Silent print (no OS dialog). Set false for testing with print preview.
    silent: true,
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
  const storageBackend = appConfig.storage.backend
  const r2Set = !!appConfig.r2.accessKeyId && !!appConfig.r2.secretAccessKey

  console.info(
    `${tag} mode=${mode} provider=${provider} supabaseConfigured=${supabaseSet} storage=${storageBackend} r2Configured=${r2Set}`,
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
