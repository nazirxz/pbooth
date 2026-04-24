import { appConfig, type TemplateId } from '@/config/app-config'
import type { CapturedPhoto } from '@/state/session-store'
import type { Theme } from '@/themes'
import logoBlackUrl from '@/asset/euorna_black.jpeg'

interface ComposeOpts {
  photos: CapturedPhoto[]
  template: TemplateId
  filterId: string
  theme: Theme
}

let cachedLogo: HTMLImageElement | null = null
async function getLogo(): Promise<HTMLImageElement> {
  if (cachedLogo) return cachedLogo
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = logoBlackUrl
  })
  cachedLogo = img
  return img
}

export async function composeStrip(opts: ComposeOpts): Promise<Blob> {
  const tmpl = appConfig.templates.find((t) => t.id === opts.template)!
  const imgs = await Promise.all(opts.photos.map(loadImage))
  const { theme } = opts

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  const PAD = 40
  const GAP = 20
  const FOOTER = 80
  const FRAME_BORDER = theme.id === 'y2k' ? 5 : 4

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

  // Paper background — solid for retro, gradient for y2k
  if (theme.id === 'y2k') {
    const grd = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
    grd.addColorStop(0, '#ffe3f1')
    grd.addColorStop(0.5, '#ffffff')
    grd.addColorStop(1, '#e4f4ff')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = theme.compose.paperBg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  if (theme.compose.noiseAmount > 0) {
    drawNoise(ctx, canvas.width, canvas.height, theme.compose.noiseAmount)
  }

  const filterClass = theme.filters.find((f) => f.id === opts.filterId)
  ctx.filter = filterClass?.css ?? 'none'

  for (let i = 0; i < imgs.length && i < cols * rows; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = PAD + col * (frameW + GAP)
    const y = PAD + row * (frameH + GAP)
    drawCover(ctx, imgs[i], x, y, frameW, frameH)
  }

  ctx.filter = 'none'

  // Frame borders — retro: sharp black; y2k: gradient pink/purple stroke
  if (theme.id === 'y2k') {
    for (let i = 0; i < imgs.length && i < cols * rows; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = PAD + col * (frameW + GAP)
      const y = PAD + row * (frameH + GAP)
      const strokeGrad = ctx.createLinearGradient(x, y, x + frameW, y + frameH)
      strokeGrad.addColorStop(0, '#ff4fa1')
      strokeGrad.addColorStop(1, '#93e9ff')
      ctx.strokeStyle = strokeGrad
      ctx.lineWidth = FRAME_BORDER
      roundRect(ctx, x - FRAME_BORDER / 2, y - FRAME_BORDER / 2, frameW + FRAME_BORDER, frameH + FRAME_BORDER, 18)
      ctx.stroke()
    }
  } else {
    ctx.strokeStyle = theme.compose.borderColor
    ctx.lineWidth = FRAME_BORDER
    for (let i = 0; i < imgs.length && i < cols * rows; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      const x = PAD + col * (frameW + GAP)
      const y = PAD + row * (frameH + GAP)
      ctx.strokeRect(x, y, frameW, frameH)
    }
  }

  // Y2K: sprinkle stickers at frame corners
  if (theme.id === 'y2k') {
    drawStickers(ctx, cols, rows, PAD, GAP, frameW, frameH)
  }

  // Footer
  const footerY = canvas.height - FOOTER + 10
  if (theme.id === 'y2k') {
    const footerGrad = ctx.createLinearGradient(0, footerY, canvas.width, footerY)
    footerGrad.addColorStop(0, '#ffe3f1')
    footerGrad.addColorStop(1, '#e4f4ff')
    ctx.fillStyle = footerGrad
    ctx.fillRect(PAD, footerY, canvas.width - PAD * 2, FOOTER - 14)
  } else {
    ctx.fillStyle = theme.compose.borderColor
    ctx.fillRect(PAD, footerY, canvas.width - PAD * 2, 3)
  }

  const logo = await getLogo().catch(() => null)
  if (logo) {
    const cropCenterY = 0.63
    const cropHeightPct = 0.22
    const srcY = logo.height * (cropCenterY - cropHeightPct / 2)
    const srcH = logo.height * cropHeightPct
    const destH = 56
    const destW = destH * (logo.width / srcH)
    const destY = footerY + (FOOTER - destH) / 2 - 2
    ctx.save()
    ctx.globalCompositeOperation = 'multiply'
    ctx.drawImage(logo, 0, srcY, logo.width, srcH, PAD + 12, destY, destW, destH)
    ctx.restore()
  } else {
    ctx.fillStyle = theme.compose.footerTextColor
    ctx.font = theme.compose.footerFontPrimary
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('EUORNA', PAD + 12, footerY + 40)
  }

  ctx.fillStyle = theme.compose.footerTextColor
  ctx.font = theme.compose.footerFontSecondary
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  const dateStr = new Date()
    .toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: '2-digit' })
    .toUpperCase()
  ctx.fillText(
    theme.id === 'y2k' ? `✦ ${dateStr} ✦` : dateStr,
    canvas.width - PAD - 12,
    footerY + 40,
  )

  if (theme.compose.scanlineOverlay) drawScanlines(ctx, canvas.width, canvas.height)

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

function roundRect(
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

function drawStickers(
  ctx: CanvasRenderingContext2D,
  cols: number,
  rows: number,
  PAD: number,
  GAP: number,
  frameW: number,
  frameH: number,
) {
  ctx.save()
  const glyphs = ['✦', '♡', '✧', '★']
  for (let i = 0; i < rows * cols; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = PAD + col * (frameW + GAP)
    const y = PAD + row * (frameH + GAP)
    ctx.font = 'bold 52px "Fredoka", sans-serif'
    ctx.fillStyle = 'rgba(255, 79, 161, 0.9)'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const g = glyphs[i % glyphs.length]
    ctx.fillText(g, x + frameW - 24, y + 24)
  }
  ctx.restore()
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}
