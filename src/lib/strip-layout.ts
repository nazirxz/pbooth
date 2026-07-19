import { appConfig, type TemplateId } from '@/config/app-config'

/**
 * 4R paper layout — shared by compose.ts (final JPG output) and DecorateScreen
 * (live preview). All coordinates are in paper pixel space at 300 DPI.
 *
 * 4R physical size  : 10.2 × 15.2 cm
 * 300 DPI pixel size: 1200 × 1800 (portrait)
 *
 * Templates render either as a single full-width strip (one column of N
 * photos) or as a cols×rows grid — both on the 4R sheet with a footer band.
 * drawCover crops the source image to fit each frame.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export type PrintMode = 'full-4x6' | 'cut-2x6'

export interface PhotoFrame extends Rect {
  photoIndex: number
}

export interface StripSection {
  /** Bounding rect of this strip within the paper (includes footer). */
  bounds: Rect
  /** Individual photo frame rects (paper coordinates). */
  frames: PhotoFrame[]
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

export function computePaperLayout(
  templateId: TemplateId,
  printMode: PrintMode = 'full-4x6',
): PaperLayout {
  const tmpl = appConfig.templates.find((t) => t.id === templateId)!
  if (printMode === 'cut-2x6') return cutGridLayout()
  return tmpl.layout === 'grid' ? portraitGridLayout(2, 2) : portraitStripLayout(tmpl.frames)
}

/**
 * cols×rows grid on the 4R sheet (e.g. 2×2 for 4 photos), sharing the same
 * footer band as the strip layout. Frames fill row-major (top-left →
 * bottom-right) so the sequential shots land in reading order. The strip
 * color shows through the OUTER margin + GAPs, framing each photo.
 */
function portraitGridLayout(cols: number, rows: number): PaperLayout {
  const { w: PW, h: PH } = PAPER_PORTRAIT
  const OUTER = 60
  const GAP = 20
  const FOOTER_H = 130

  const frameW = (PW - OUTER * 2 - GAP * (cols - 1)) / cols
  const frameH = (PH - OUTER * 2 - FOOTER_H - GAP * (rows - 1)) / rows

  const frames: PhotoFrame[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      frames.push({
        x: OUTER + c * (frameW + GAP),
        y: OUTER + r * (frameH + GAP),
        w: frameW,
        h: frameH,
        photoIndex: r * cols + c,
      })
    }
  }

  const section: StripSection = {
    bounds: { x: 0, y: 0, w: PW, h: PH },
    frames,
    footer: { x: OUTER, y: PH - OUTER - FOOTER_H, w: PW - OUTER * 2, h: FOOTER_H },
  }

  return { paper: PAPER_PORTRAIT, orientation: 'portrait', sections: [section] }
}

/**
 * Keeps the four-photo GRID composition while making each physical 2x6 half
 * self-contained. The DNP driver cuts vertically at the paper midpoint.
 */
function cutGridLayout(): PaperLayout {
  const { w: PW, h: PH } = PAPER_PORTRAIT
  const HALF_W = PW / 2
  const OUTER_X = 36
  const OUTER_Y = 60
  const FRAME_GAP = 20
  const FOOTER_H = 130
  const frameW = HALF_W - OUTER_X * 2
  const frameH = (PH - OUTER_Y * 2 - FOOTER_H - FRAME_GAP) / 2

  const section = (offsetX: number, photoIndexes: [number, number]): StripSection => ({
    bounds: { x: offsetX, y: 0, w: HALF_W, h: PH },
    frames: photoIndexes.map((photoIndex, row) => ({
      x: offsetX + OUTER_X,
      y: OUTER_Y + row * (frameH + FRAME_GAP),
      w: frameW,
      h: frameH,
      photoIndex,
    })),
    footer: {
      x: offsetX + OUTER_X,
      y: PH - OUTER_Y - FOOTER_H,
      w: frameW,
      h: FOOTER_H,
    },
  })

  return {
    paper: PAPER_PORTRAIT,
    orientation: 'portrait',
    sections: [section(0, [0, 2]), section(HALF_W, [1, 3])],
    cutLine: { x: HALF_W, y1: 0, y2: PH },
  }
}

function portraitStripLayout(frameCount: number): PaperLayout {
  const { w: PW, h: PH } = PAPER_PORTRAIT
  const OUTER = 60
  const FRAME_GAP = 20
  const FOOTER_H = 130

  const photoAreaH = PH - OUTER * 2 - FOOTER_H
  const frameW = PW - OUTER * 2
  const frameH = (photoAreaH - FRAME_GAP * (frameCount - 1)) / frameCount

  const frames: PhotoFrame[] = []
  for (let i = 0; i < frameCount; i++) {
    frames.push({
      x: OUTER,
      y: OUTER + i * (frameH + FRAME_GAP),
      w: frameW,
      h: frameH,
      photoIndex: i,
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
