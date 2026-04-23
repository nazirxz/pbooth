import { appConfig, type FilterId, type TemplateId } from '@/config/app-config'
import type { CapturedPhoto } from '@/state/session-store'

interface ComposeOpts {
  photos: CapturedPhoto[]
  template: TemplateId
  filter: FilterId
}

const CANVAS_FILTER_MAP: Record<FilterId, string> = {
  'none': 'none',
  'bw-grain': 'grayscale(1) contrast(1.15) brightness(1.05)',
  'sepia': 'sepia(0.75) contrast(1.1) saturate(1.2)',
  'vhs': 'saturate(1.4) contrast(1.2) hue-rotate(-5deg)',
  'neon-80s': 'saturate(1.6) contrast(1.3) hue-rotate(280deg)',
  'polaroid': 'saturate(0.85) contrast(0.95) brightness(1.08)',
}

/**
 * Composes captured photos into a single printable strip/grid JPEG.
 * Output dimensions target ~2:3 print aspect for strips, 1:1-ish for grid.
 */
export async function composeStrip(opts: ComposeOpts): Promise<Blob> {
  const tmpl = appConfig.templates.find((t) => t.id === opts.template)!
  const imgs = await Promise.all(opts.photos.map(loadImage))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const PAD = 40
  const GAP = 20
  const FOOTER = 80
  const FRAME_BORDER = 4

  let frameW: number
  let frameH: number
  let cols: number
  let rows: number

  if (tmpl.layout === 'grid') {
    cols = 2
    rows = 2
    frameW = 520
    frameH = 390
  } else {
    cols = 1
    rows = tmpl.frames
    frameW = 600
    frameH = 450
  }

  canvas.width = PAD * 2 + cols * frameW + (cols - 1) * GAP
  canvas.height = PAD * 2 + rows * frameH + (rows - 1) * GAP + FOOTER

  // Cream/polaroid background
  ctx.fillStyle = '#f5e6c8'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Subtle paper texture (noise)
  drawNoise(ctx, canvas.width, canvas.height, 0.04)

  ctx.filter = CANVAS_FILTER_MAP[opts.filter] ?? 'none'

  for (let i = 0; i < imgs.length && i < cols * rows; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = PAD + col * (frameW + GAP)
    const y = PAD + row * (frameH + GAP)
    drawCover(ctx, imgs[i], x, y, frameW, frameH)
  }

  ctx.filter = 'none'

  // Frame borders on top (sharp, no filter)
  ctx.strokeStyle = '#1a1412'
  ctx.lineWidth = FRAME_BORDER
  for (let i = 0; i < imgs.length && i < cols * rows; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = PAD + col * (frameW + GAP)
    const y = PAD + row * (frameH + GAP)
    ctx.strokeRect(x, y, frameW, frameH)
  }

  // Footer — retro brand strip
  const footerY = canvas.height - FOOTER + 10
  ctx.fillStyle = '#1a1412'
  ctx.fillRect(PAD, footerY, canvas.width - PAD * 2, 4)
  ctx.fillStyle = '#1a1412'
  ctx.font = 'bold 32px "Press Start 2P", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('PBOOTH', PAD + 6, footerY + 40)
  ctx.font = '24px "VT323", monospace'
  ctx.textAlign = 'right'
  ctx.fillText(
    new Date()
      .toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' })
      .toUpperCase(),
    canvas.width - PAD - 6,
    footerY + 40,
  )

  // Light scanline overlay — prints nicely on cream paper
  drawScanlines(ctx, canvas.width, canvas.height)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compose toBlob failed'))), 'image/jpeg', 0.92)
  })
}

function loadImage(photo: CapturedPhoto): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = photo.dataUrl
  })
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const ir = img.width / img.height
  const dr = dw / dh
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ir > dr) {
    // image wider than frame — crop horizontally
    sw = img.height * dr
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / dr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

function drawNoise(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number) {
  const id = ctx.getImageData(0, 0, w, h)
  const d = id.data
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * amt
    d[i] = clamp(d[i] + n)
    d[i + 1] = clamp(d[i + 1] + n)
    d[i + 2] = clamp(d[i + 2] + n)
  }
  ctx.putImageData(id, 0, 0)
}

function drawScanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save()
  ctx.globalAlpha = 0.05
  ctx.fillStyle = '#000'
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1)
  ctx.restore()
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}
