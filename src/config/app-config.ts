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
    // 'dslr'   = Canon EOS DSLR (e.g. EOS 800D) via digiCamControl HTTP API for
    //            tethered capture — real mechanical-shutter stills so the pop-up
    //            flash actually fires and we get full-res JPEGs. HDMI capture card
    //            is used only for the live preview.
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
       *
       * FLASH SYNC: with a flash the shutter must stay at/below the body's
       * X-sync speed (1/200s on the EOS 800D) or a black band appears. Keep
       * VITE_DCC_SHUTTER <= 1/200 (1/125–1/160 is the safe range).
       * WHITE BALANCE: default 'Flash' keeps colours consistent since the
       * pop-up flash is the dominant light source.
       */
      capture: {
        iso: import.meta.env.VITE_DCC_ISO ?? '400',
        shutter: import.meta.env.VITE_DCC_SHUTTER ?? '1/125',
        aperture: import.meta.env.VITE_DCC_APERTURE ?? '5.6',
        whitebalance: import.meta.env.VITE_DCC_WB ?? 'Flash',
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
    countdownSec: parseInt(import.meta.env.VITE_CAPTURE_COUNTDOWN_SEC ?? '5', 10),
    // How long to show the just-captured photo as a review popup before the
    // next shot — doubles as confirmation feedback and hides the tether
    // download wait behind something the customer actually wants to see.
    reviewMs: 1_500,
    // Brief breath after the review before the next countdown starts.
    delayBetweenFramesMs: 250,
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
    devSkipButton: import.meta.env.DEV || import.meta.env.VITE_DEV_SKIP_BUTTON === 'true',
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
    // Substring of the printer's name in the Windows printer list. The main
    // process matches it case-insensitively against installed printers, so
    // "DS-RX1" also matches "DNP DS-RX1". Leave empty to use the system
    // default printer. Override per kiosk with VITE_PRINTER_NAME.
    deviceName: import.meta.env.VITE_PRINTER_NAME ?? 'DS-RX1',
    // Silent print (no OS dialog). Set false for testing with print preview.
    silent: import.meta.env.VITE_PRINTER_SILENT !== 'false',
    // Print orientation (landscape vs portrait).
    landscape: import.meta.env.VITE_PRINTER_LANDSCAPE === 'true',
    // Print rotation in degrees (0, 90, 180, 270).
    rotation: parseInt(import.meta.env.VITE_PRINTER_ROTATION ?? '0', 10),
  },
  templates: [
    { id: 'duo-2', label: 'DUO', frames: 2, layout: 'vertical' },
    { id: 'strip-3', label: 'TRIO', frames: 3, layout: 'vertical' },
    { id: 'strip-4', label: 'GRID', frames: 4, layout: 'grid' },
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
