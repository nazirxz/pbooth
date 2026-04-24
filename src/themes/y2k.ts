import { GlassFrame } from '@/components/GlassFrame'
import type { Theme } from './types'

export const y2kTheme: Theme = {
  id: 'y2k',
  name: 'Y2K GLOW',
  short: 'Pink × Cyan × Sparkle • Bubblegum pop',
  mode: 'light',
  fonts: {
    display: '"Fredoka", "Baloo 2", system-ui, sans-serif',
    body: '"Space Grotesk", "Inter", sans-serif',
    mono: '"Space Mono", monospace',
  },
  filters: [
    { id: 'none', label: 'NATURAL', css: 'none' },
    { id: 'bubblegum', label: 'BUBBLEGUM', css: 'saturate(1.3) contrast(1.05) hue-rotate(-12deg)' },
    { id: 'dreamy', label: 'DREAMY', css: 'saturate(0.9) contrast(0.95) brightness(1.1) blur(0.3px)' },
    { id: 'hologram', label: 'HOLOGRAM', css: 'saturate(1.6) contrast(1.15) hue-rotate(180deg)' },
    { id: 'kawaii', label: 'KAWAII', css: 'saturate(1.1) brightness(1.12) contrast(0.92)' },
    { id: 'peach', label: 'PEACH', css: 'saturate(1.2) sepia(0.2) hue-rotate(-10deg) brightness(1.05)' },
  ],
  effects: {
    scanlines: false,
    flicker: false,
    rgbSplit: false,
    sparkle: true,
    glassPanel: true,
  },
  compose: {
    paperBg: '#ffffff',
    borderColor: '#ff4fa1',
    footerBg: '#ffe3f1',
    footerTextColor: '#7a1e52',
    footerFontPrimary: '800 30px "Fredoka", "Baloo 2", sans-serif',
    footerFontSecondary: '20px "Space Grotesk", sans-serif',
    noiseAmount: 0,
    scanlineOverlay: false,
  },
  preview: {
    background:
      'linear-gradient(135deg, #ffb3d9 0%, #c3a4ff 50%, #93e9ff 100%)',
    title: 'Y2K GLOW',
    tagline: 'Pink × Cyan × Sparkle',
    vibe: ['GLASS PANEL', 'MESH GRADIENT', 'SPARKLE ✦', 'BUBBLE POP'],
  },
  FrameComponent: GlassFrame,
}
