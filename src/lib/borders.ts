/**
 * Borders library. Each border defines two renderers:
 *   - `renderDom`  — quick DOM preview inside DecorateScreen (CSS only)
 *   - `renderCanvas` — the canonical draw call used by compose.ts
 * Borders are drawn **around each individual photo frame**, not the whole paper.
 */

export type BorderThemeScope = 'all' | 'retro' | 'y2k'

export interface BorderDef {
  id: string
  name: string
  theme: BorderThemeScope
  /** Optional hex/gradient hint for the palette swatch. */
  swatch: string
  /**
   * Canvas draw fn — invoked after each photo has been painted to (x,y,w,h).
   * The border should sit on top of the frame edge.
   */
  renderCanvas: (ctx: CanvasRenderingContext2D, bounds: BorderBounds) => void
}

export interface BorderBounds {
  x: number
  y: number
  w: number
  h: number
  /** 'retro' | 'y2k' — some borders adapt colors to the active theme. */
  themeId: string
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export const BORDERS: BorderDef[] = [
  {
    id: 'none',
    name: 'NONE',
    theme: 'all',
    swatch: 'transparent',
    renderCanvas: () => {},
  },
  {
    id: 'classic-black',
    name: 'CLASSIC',
    theme: 'all',
    swatch: '#1a1412',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.strokeStyle = '#1a1412'
      ctx.lineWidth = 5
      ctx.strokeRect(x, y, w, h)
    },
  },
  {
    id: 'double-line',
    name: 'DOUBLE',
    theme: 'all',
    swatch: 'repeating-linear-gradient(90deg,#1a1412 0 10px,transparent 10px 14px,#1a1412 14px 20px)',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.strokeStyle = '#1a1412'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)
      ctx.strokeRect(x + 6, y + 6, w - 12, h - 12)
    },
  },
  {
    id: 'dashed',
    name: 'DASHED',
    theme: 'all',
    swatch: 'repeating-linear-gradient(90deg,#1a1412 0 12px,transparent 12px 20px)',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.strokeStyle = '#1a1412'
      ctx.lineWidth = 4
      ctx.setLineDash([14, 10])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
    },
  },
  {
    id: 'neon-glow',
    name: 'NEON GLOW',
    theme: 'retro',
    swatch: '#00f0ff',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.save()
      ctx.strokeStyle = '#00f0ff'
      ctx.lineWidth = 4
      ctx.shadowColor = '#00f0ff'
      ctx.shadowBlur = 24
      ctx.strokeRect(x, y, w, h)
      ctx.strokeStyle = '#ff006e'
      ctx.shadowColor = '#ff006e'
      ctx.lineWidth = 2
      ctx.strokeRect(x + 4, y + 4, w - 8, h - 8)
      ctx.restore()
    },
  },
  {
    id: 'film-strip',
    name: 'FILM STRIP',
    theme: 'retro',
    swatch: '#000',
    renderCanvas: (ctx, { x, y, w, h }) => {
      const pad = 16
      ctx.fillStyle = '#000'
      ctx.fillRect(x - pad, y - 4, w + pad * 2, 4)
      ctx.fillRect(x - pad, y + h, w + pad * 2, 4)
      ctx.fillStyle = '#f5e6c8'
      const holeW = 14
      const holeH = 10
      const step = 28
      for (let i = 0; i < Math.floor((w + pad * 2) / step); i++) {
        const hx = x - pad + 6 + i * step
        ctx.fillRect(hx, y - 3, holeW, holeH)
        ctx.fillRect(hx, y + h - holeH + 3, holeW, holeH)
      }
      ctx.strokeStyle = '#1a1412'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)
    },
  },
  {
    id: 'rainbow-bars',
    name: 'TV BARS',
    theme: 'retro',
    swatch: 'linear-gradient(90deg,#ff0080,#ffbe0b,#00e5ff)',
    renderCanvas: (ctx, { x, y, w, h }) => {
      const colors = ['#ffffff', '#ffd60a', '#00e5ff', '#2fbf71', '#ff4fa1', '#ff3b30', '#4b3fff']
      const barW = w / colors.length
      ctx.save()
      colors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.fillRect(x + i * barW, y - 10, barW, 6)
        ctx.fillRect(x + i * barW, y + h + 4, barW, 6)
      })
      ctx.strokeStyle = '#1a1412'
      ctx.lineWidth = 4
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    },
  },
  {
    id: 'pink-gradient',
    name: 'PINK DREAM',
    theme: 'y2k',
    swatch: 'linear-gradient(135deg,#ff4fa1,#93e9ff)',
    renderCanvas: (ctx, { x, y, w, h }) => {
      const grd = ctx.createLinearGradient(x, y, x + w, y + h)
      grd.addColorStop(0, '#ff4fa1')
      grd.addColorStop(1, '#93e9ff')
      ctx.strokeStyle = grd
      ctx.lineWidth = 6
      rounded(ctx, x - 3, y - 3, w + 6, h + 6, 18)
      ctx.stroke()
    },
  },
  {
    id: 'hearts',
    name: 'HEARTS',
    theme: 'y2k',
    swatch: '#ff4fa1',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.strokeStyle = '#ff4fa1'
      ctx.lineWidth = 3
      ctx.strokeRect(x, y, w, h)
      ctx.font = 'bold 26px "Fredoka", sans-serif'
      ctx.fillStyle = '#ff4fa1'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const step = 56
      const n = Math.floor(w / step)
      for (let i = 0; i < n; i++) {
        const cx = x + step / 2 + i * step + (w - n * step) / 2
        ctx.fillText('♡', cx, y - 4)
        ctx.fillText('♡', cx, y + h + 4)
      }
    },
  },
  {
    id: 'sparkle',
    name: 'SPARKLE',
    theme: 'y2k',
    swatch: 'linear-gradient(135deg,#fff7a3,#ff4fa1)',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.save()
      ctx.strokeStyle = '#ff7ac4'
      ctx.lineWidth = 4
      ctx.setLineDash([8, 6])
      ctx.strokeRect(x, y, w, h)
      ctx.setLineDash([])
      ctx.font = 'bold 34px "Fredoka", sans-serif'
      ctx.fillStyle = '#ffbe0b'
      const corners = [
        [x - 8, y - 8],
        [x + w - 18, y - 8],
        [x - 8, y + h - 18],
        [x + w - 18, y + h - 18],
      ] as const
      corners.forEach(([cx, cy]) => ctx.fillText('✦', cx, cy))
      ctx.restore()
    },
  },
  {
    id: 'washi-tape',
    name: 'WASHI',
    theme: 'y2k',
    swatch: 'repeating-linear-gradient(45deg,#ff4fa1 0 8px,#ffd1e8 8px 16px)',
    renderCanvas: (ctx, { x, y, w, h }) => {
      ctx.strokeStyle = '#cda4ff'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)
      const drawTape = (cx: number, cy: number, tw: number, th: number, rot: number, colors: [string, string]) => {
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(rot)
        const gradient = ctx.createLinearGradient(0, -th / 2, 0, th / 2)
        gradient.addColorStop(0, colors[0])
        gradient.addColorStop(1, colors[1])
        ctx.fillStyle = gradient
        ctx.globalAlpha = 0.85
        ctx.fillRect(-tw / 2, -th / 2, tw, th)
        ctx.restore()
      }
      drawTape(x + 20, y - 2, 80, 26, -0.18, ['#ff4fa1', '#ffd1e8'])
      drawTape(x + w - 20, y + h + 2, 80, 26, 0.15, ['#93e9ff', '#e4f4ff'])
    },
  },
]

export function getBorder(id: string | null | undefined): BorderDef {
  if (!id) return BORDERS[0]
  return BORDERS.find((b) => b.id === id) ?? BORDERS[0]
}

export function bordersForTheme(themeId: string): BorderDef[] {
  return BORDERS.filter((b) => b.theme === 'all' || b.theme === themeId)
}
