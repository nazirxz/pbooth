import type { ReactNode } from 'react'

export type ThemeId = 'retro' | 'y2k'

export interface ThemeFilter {
  id: string
  label: string
  /** CSS filter string applied to live video preview + the <img> in compose. */
  css: string
}

export interface ThemeEffects {
  scanlines: boolean
  flicker: boolean
  rgbSplit: boolean
  sparkle: boolean
  glassPanel: boolean
}

export interface ThemeComposeStyle {
  paperBg: string            // canvas fill for the strip paper
  borderColor: string        // per-photo frame stroke
  footerBg: string           // footer block fill
  footerTextColor: string
  footerFontPrimary: string  // canvas font string
  footerFontSecondary: string
  noiseAmount: number        // 0-1; applied as paper noise
  scanlineOverlay: boolean
}

export interface ThemePreview {
  /** Preview tile gradient/background for the theme-select cards. */
  background: string
  title: string
  tagline: string
  vibe: string[]
}

export interface Theme {
  id: ThemeId
  name: string           // display name, e.g. "RETRO TV"
  short: string          // one-line pitch
  mode: 'dark' | 'light'
  fonts: {
    display: string      // headline / pixel-looking
    body: string         // body / UI text
    mono: string
  }
  filters: ThemeFilter[]
  effects: ThemeEffects
  compose: ThemeComposeStyle
  preview: ThemePreview
  FrameComponent: (props: { children: ReactNode }) => ReactNode
}
