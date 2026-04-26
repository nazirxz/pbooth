import { appConfig, type TemplateId } from '@/config/app-config'

/**
 * 4R paper layout — shared by compose.ts (final JPG output) and DecorateScreen
 * (live preview). All coordinates are in paper pixel space at 300 DPI.
 *
 * 4R physical size  : 10.2 × 15.2 cm
 * 300 DPI pixel size: 1200 × 1800 (portrait)
 *
 * All templates render as a single full-width strip on the 4R sheet —
 * one column of N photos with a footer. drawCover crops the source webcam
 * image to fit each frame, so face crop will tighten as N grows.
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
  const OUTER = 60
  const FRAME_GAP = 20
  const FOOTER_H = 130

  const photoAreaH = PH - OUTER * 2 - FOOTER_H
  const frameW = PW - OUTER * 2
  const frameH = (photoAreaH - FRAME_GAP * (frameCount - 1)) / frameCount

  const frames: Rect[] = []
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      x: OUTER,
      y: OUTER + i * (frameH + FRAME_GAP),
      w: frameW,
      h: frameH,
    })
  }

  const section: StripSection = {
    bounds: { x: 0, y: 0, w: PW, h: PH },
    frames,
    footer: { x: OUTER, y: PH - OUTER - FOOTER_H, w: PW - OUTER * 2, h: FOOTER_H },
  }

  return {
    paper: PAPER_PORTRAIT,
    orientation: 'portrait',
    sections: [section],
  }
}

