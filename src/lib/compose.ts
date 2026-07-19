import { type TemplateId } from '@/config/app-config'
import type { CapturedPhoto } from '@/state/session-store'
import type { PlacedSticker } from '@/state/decoration-store'
import { getSticker } from '@/lib/stickers'
import {
  computePaperLayout,
  type PaperLayout,
  type PhotoFrame,
  type PrintMode,
  type Rect,
} from '@/lib/strip-layout'
import type { Theme } from '@/themes'
import qrCodeUrl from '@/asset/qrcode_euorna_profile.jpeg'

interface ComposeOpts {
  photos: CapturedPhoto[]
  template: TemplateId
  filterId: string
  printMode: PrintMode
  theme: Theme
  decoration?: {
    /** Paper/strip background color. Falls back to theme paperBg when omitted. */
    stripColor?: string
    stickers: PlacedSticker[]
  }
}

let cachedQr: HTMLImageElement | null = null
async function getQr(): Promise<HTMLImageElement> {
  if (cachedQr) return cachedQr
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = reject
    img.src = qrCodeUrl
  })
  cachedQr = img
  return img
}

/**
 * Composes captured photos into a 4R-ready JPEG. Strip templates print as
 * two identical copies side-by-side so customers can cut and share.
 */
export async function composeStrip(opts: ComposeOpts): Promise<Blob> {
  const layout = computePaperLayout(opts.template, opts.printMode)
  const imgs = await Promise.all(opts.photos.map(loadImage))
  const stickerImages = await loadStickerImages(opts.decoration?.stickers ?? [])

  const canvas = document.createElement('canvas')
  canvas.width = layout.paper.w
  canvas.height = layout.paper.h
  const ctx = canvas.getContext('2d')!

  // Paper background — customer-picked strip color overrides the theme default
  const paperBg = opts.decoration?.stripColor ?? opts.theme.compose.paperBg
  ctx.fillStyle = paperBg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  if (opts.theme.compose.noiseAmount > 0) {
    drawNoise(ctx, canvas.width, canvas.height, opts.theme.compose.noiseAmount)
  }

  const qr = await getQr().catch(() => null)

  // Draw each strip section
  for (const section of layout.sections) {
    drawSectionFrames(ctx, section, imgs, opts)
    drawSectionFooter(ctx, section.footer, qr, opts.theme, paperBg)
  }

  // Placed stickers (paper-level, drawn once on top of everything)
  if (opts.decoration?.stickers?.length) {
    drawPlacedStickers(ctx, canvas.width, canvas.height, opts.decoration.stickers, stickerImages)
  }

  if (opts.theme.compose.scanlineOverlay) {
    drawScanlines(ctx, canvas.width, canvas.height)
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('compose toBlob failed'))), 'image/jpeg', 0.92)
  })
}

function drawSectionFrames(
  ctx: CanvasRenderingContext2D,
  section: { frames: PhotoFrame[] },
  imgs: HTMLImageElement[],
  opts: ComposeOpts,
) {
  const filterCss = opts.theme.filters.find((f) => f.id === opts.filterId)?.css ?? 'none'
  ctx.filter = filterCss
  for (const f of section.frames) {
    const img = imgs[f.photoIndex]
    if (!img) continue
    drawCover(ctx, img, f.x, f.y, f.w, f.h)
  }
  ctx.filter = 'none'
}

function drawSectionFooter(
  ctx: CanvasRenderingContext2D,
  footer: Rect,
  qr: HTMLImageElement | null,
  theme: Theme,
  paperBg: string,
) {
  ctx.save()

  // Footer ink has to contrast the customer-picked strip color — the dark
  // theme text vanishes on a dark strip. Use light ink on dark paper.
  const dark = isDarkColor(paperBg)
  const ink = dark ? '#f5e6c8' : theme.compose.footerTextColor

  // QR code on the bottom-left. On a dark strip, sit it on a white quiet-zone
  // card so it stays scannable.
  const qrSize = Math.min(footer.h - 16, 110)
  const qrX = footer.x + 8
  const qrY = footer.y + (footer.h - qrSize) / 2
  if (qr) {
    if (dark) {
      const pad = 6
      ctx.fillStyle = '#ffffff'
      roundRect(ctx, qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 6)
      ctx.fill()
    }
    ctx.drawImage(qr, qrX, qrY, qrSize, qrSize)
  } else {
    ctx.strokeStyle = ink
    ctx.lineWidth = 2
    ctx.strokeRect(qrX, qrY, qrSize, qrSize)
  }

  ctx.fillStyle = ink
  ctx.font = `28px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  ctx.fillText('euorna-booth', footer.x + footer.w - 12, footer.y + footer.h / 2)

  ctx.restore()
}

/** Perceived-luminance check (0–255 scale); below mid reads as a dark color. */
function isDarkColor(hex: string): boolean {
  const c = hex.replace('#', '')
  const n = c.length === 3 ? c.replace(/(.)/g, '$1$1') : c
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b < 140
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
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

function drawPlacedStickers(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  stickers: PlacedSticker[],
  images: Map<string, HTMLImageElement>,
) {
  for (const s of stickers) {
    const def = getSticker(s.assetId)
    const img = def ? images.get(def.id) : undefined
    if (!img) continue
    const maxSize = 120 * s.scale
    const ratio = img.naturalWidth / img.naturalHeight
    const width = ratio >= 1 ? maxSize : maxSize * ratio
    const height = ratio >= 1 ? maxSize / ratio : maxSize
    const px = s.x * canvasW
    const py = s.y * canvasH
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(s.rotation)
    ctx.drawImage(img, -width / 2, -height / 2, width, height)
    ctx.restore()
  }
}

async function loadStickerImages(stickers: PlacedSticker[]): Promise<Map<string, HTMLImageElement>> {
  const defs = [...new Set(stickers.map((sticker) => sticker.assetId))]
    .map(getSticker)
    .filter((def): def is NonNullable<typeof def> => Boolean(def))
  const loaded = await Promise.all(defs.map(async (def) => [def.id, await loadImageUrl(def.src)] as const))
  return new Map(loaded)
}

function loadImageUrl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

export type { PaperLayout }
