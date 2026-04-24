import { appConfig, type TemplateId } from '@/config/app-config'

/**
 * 4R paper layout — shared by compose.ts (final JPG output) and DecorateScreen
 * (live preview). All coordinates are in paper pixel space at 300 DPI.
 *
 * 4R physical size  : 10.2 × 15.2 cm
 * 300 DPI pixel size: 1200 × 1800 (portrait) or 1800 × 1200 (landscape)
 *
 * Strip templates (strip-3, strip-4) print as a classic "2-up" — two identical
 * strips side-by-side on one 4R sheet, meant to be cut in half so each customer
 * gets two copies (one to keep, one to share). Grid templates use the full
 * 4R landscape canvas.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface StripSection {
  /** Bounding rect of this strip within the paper (includes footer). */
  bounds: Rect
  /** Individual photo frame rects (paper coordinates). */
  frames: Rect[]
  /** Footer band inside this strip (paper coordinates). */
  footer: Rect
}

export interface PaperLayout {
  paper: { w: number; h: number }
  orientation: 'portrait' | 'landscape'
  sections: StripSection[]
  /** Optional vertical cut line (for 2-up strips). */
  cutLine?: { x: number; y1: number; y2: number }
}

const PAPER_PORTRAIT = { w: 1200, h: 1800 }
const PAPER_LANDSCAPE = { w: 1800, h: 1200 }

export function computePaperLayout(templateId: TemplateId): PaperLayout {
  const tmpl = appConfig.templates.find((t) => t.id === templateId)!

  if (tmpl.layout === 'grid') {
    return landscapeGridLayout(tmpl.frames)
  }
  return portraitStripLayout(tmpl.frames)
}

function portraitStripLayout(frameCount: number): PaperLayout {
  const { w: PW, h: PH } = PAPER_PORTRAIT
  const OUTER = 40
  const GUTTER = 24
  const STRIP_W = (PW - OUTER * 2 - GUTTER) / 2        // one strip's width
  const INNER_PAD = 20                                  // pad inside a strip
  const FRAME_GAP = 18
  const FOOTER_H = 120

  const sections: StripSection[] = []

  for (let s = 0; s < 2; s++) {
    const sx = OUTER + s * (STRIP_W + GUTTER)
    const sy = OUTER
    const photoAreaH = PH - OUTER * 2 - FOOTER_H
    const frameW = STRIP_W - INNER_PAD * 2
    const frameH = (photoAreaH - INNER_PAD * 2 - FRAME_GAP * (frameCount - 1)) / frameCount

    const frames: Rect[] = []
    for (let i = 0; i < frameCount; i++) {
      frames.push({
        x: sx + INNER_PAD,
        y: sy + INNER_PAD + i * (frameH + FRAME_GAP),
        w: frameW,
        h: frameH,
      })
    }

    sections.push({
      bounds: { x: sx, y: sy, w: STRIP_W, h: PH - OUTER * 2 },
      frames,
      footer: { x: sx, y: PH - OUTER - FOOTER_H, w: STRIP_W, h: FOOTER_H },
    })
  }

  const cutX = OUTER + STRIP_W + GUTTER / 2
  return {
    paper: PAPER_PORTRAIT,
    orientation: 'portrait',
    sections,
    cutLine: { x: cutX, y1: OUTER / 2, y2: PH - OUTER / 2 },
  }
}

function landscapeGridLayout(frameCount: number): PaperLayout {
  const { w: PW, h: PH } = PAPER_LANDSCAPE
  const OUTER = 60
  const GAP = 24
  const FOOTER_H = 110

  const cols = 2
  const rows = Math.ceil(frameCount / cols)

  const gridW = PW - OUTER * 2
  const gridH = PH - OUTER * 2 - FOOTER_H
  const cellW = (gridW - GAP * (cols - 1)) / cols
  const cellH = (gridH - GAP * (rows - 1)) / rows

  const frames: Rect[] = []
  for (let i = 0; i < frameCount; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    frames.push({
      x: OUTER + c * (cellW + GAP),
      y: OUTER + r * (cellH + GAP),
      w: cellW,
      h: cellH,
    })
  }

  const section: StripSection = {
    bounds: { x: 0, y: 0, w: PW, h: PH },
    frames,
    footer: { x: OUTER, y: PH - OUTER - FOOTER_H, w: PW - OUTER * 2, h: FOOTER_H },
  }

  return {
    paper: PAPER_LANDSCAPE,
    orientation: 'landscape',
    sections: [section],
  }
}
