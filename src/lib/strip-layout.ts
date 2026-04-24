import { appConfig, type TemplateId } from '@/config/app-config'

/**
 * 4R paper layout — shared by compose.ts (final JPG output) and DecorateScreen
 * (live preview). All coordinates are in paper pixel space at 300 DPI.
 *
 * 4R physical size  : 10.2 × 15.2 cm
 * 300 DPI pixel size: 1200 × 1800 (portrait)
 *
 * All current templates print as a classic "2-up" — two identical strips
 * side-by-side on one 4R sheet, meant to be cut in half so each customer
 * gets two copies (one to keep, one to share).
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

export function computePaperLayout(templateId: TemplateId): PaperLayout {
  const tmpl = appConfig.templates.find((t) => t.id === templateId)!
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

