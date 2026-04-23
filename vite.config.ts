import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

// Build target is either 'electron' (default, desktop kiosk) or 'web' (browser/PWA).
// Web mode skips the electron plugin so output is a static SPA deployable to Vercel/Netlify.
const isWeb = process.env.PBOOTH_TARGET === 'web'

export default defineConfig({
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  plugins: [
    react(),
    ...(isWeb
      ? []
      : [
          electron({
            main: { entry: 'electron/main.ts' },
            preload: { input: path.join(__dirname, 'electron/preload.ts') },
            renderer: {},
          }),
        ]),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: isWeb ? true : 'localhost',
  },
  build: {
    outDir: isWeb ? 'dist-web' : 'dist',
    emptyOutDir: true,
  },
})
