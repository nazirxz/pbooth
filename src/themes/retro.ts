import { CRTFrame } from '@/components/CRTFrame'
import type { Theme } from './types'

export const retroTheme: Theme = {
  id: 'retro',
  name: 'RETRO TV',
  short: 'VHS scanlines • CRT glow • NTSC phosphor',
  mode: 'dark',
  fonts: {
    display: '"Press Start 2P", monospace',
    body: '"VT323", monospace',
    mono: '"IBM Plex Mono", monospace',
  },
  filters: [
    { id: 'none', label: 'NORMAL', css: 'none' },
    { id: 'bw-grain', label: 'B&W GRAIN', css: 'grayscale(1) contrast(1.15) brightness(1.05)' },
    { id: 'sepia', label: 'SEPIA', css: 'sepia(0.75) contrast(1.1) saturate(1.2)' },
    { id: 'vhs', label: 'VHS', css: 'saturate(1.4) contrast(1.2) hue-rotate(-5deg)' },
    { id: 'neon-80s', label: '80s NEON', css: 'saturate(1.6) contrast(1.3) hue-rotate(280deg)' },
    { id: 'polaroid', label: 'POLAROID', css: 'saturate(0.85) contrast(0.95) brightness(1.08)' },
  ],
  effects: {
    scanlines: true,
    flicker: true,
    rgbSplit: true,
    sparkle: false,
    glassPanel: false,
  },
  compose: {
    paperBg: '#f5e6c8',
    borderColor: '#1a1412',
    footerBg: '#f5e6c8',
    footerTextColor: '#1a1412',
    footerFontPrimary: 'bold 32px "Press Start 2P", monospace',
    footerFontSecondary: '24px "VT323", monospace',
    noiseAmount: 0.04,
    scanlineOverlay: true,
  },
  preview: {
    background:
      'radial-gradient(ellipse at center, #222 0%, #000 70%), repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)',
    title: 'RETRO TV',
    tagline: 'VHS × CRT × NTSC',
    vibe: ['SCANLINES', 'RGB SPLIT', 'CRT BEZEL', 'PHOSPHOR GREEN'],
  },
  FrameComponent: CRTFrame,
}
