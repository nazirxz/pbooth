import type { CapturedPhoto } from '@/state/session-store'
import type { Theme } from '@/themes'
import { getBorder } from '@/lib/borders'

const VIDEO_W = 800
const VIDEO_H = 600
const PAD = 30
const FRAME_W = VIDEO_W - PAD * 2
const FRAME_H = VIDEO_H - PAD * 2

const TOTAL_DURATION_MS = 5_000
const TRANSITION_MS = 220
const FPS = 30

export interface LivePhotoOpts {
  photos: CapturedPhoto[]
  borderId: string
  theme: Theme
}

export interface LivePhotoResult {
  blob: Blob
  mimeType: string
  ext: 'webm' | 'mp4'
}

/**
 * Records a short clip cycling through the captured frames with a CRT
 * channel-change transition. Output is whatever container the platform
 * supports (mp4 first, webm fallback).
 */
export async function generateLivePhoto(opts: LivePhotoOpts): Promise<LivePhotoResult> {
  const imgs = await Promise.all(opts.photos.map(loadImage))
  if (imgs.length === 0) throw new Error('No photos to assemble')

  const canvas = document.createElement('canvas')
  canvas.width = VIDEO_W
  canvas.height = VIDEO_H
  const ctx = canvas.getContext('2d')!

  const mimeType = pickMimeType()
  if (!mimeType) throw new Error('MediaRecorder has no compatible mime type')

  // Prime the canvas with the first frame before starting the recorder
  drawPhoto(ctx, imgs[0], opts)

  const stream = canvas.captureStream(FPS)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }
  recorder.start(150)

  const startTime = performance.now()
  const perPhotoMs = TOTAL_DURATION_MS / imgs.length

  await new Promise<void>((resolve) => {
    const tick = () => {
      const elapsed = performance.now() - startTime
      if (elapsed >= TOTAL_DURATION_MS) {
        // Last paint — make sure the final frame is visible briefly before stop
        drawPhoto(ctx, imgs[imgs.length - 1], opts)
        resolve()
        return
      }

      const photoIdx = Math.min(imgs.length - 1, Math.floor(elapsed / perPhotoMs))
      const phaseInPhoto = elapsed - photoIdx * perPhotoMs
      if (photoIdx > 0 && phaseInPhoto < TRANSITION_MS) {
        drawStatic(ctx, phaseInPhoto / TRANSITION_MS)
      } else {
        drawPhoto(ctx, imgs[photoIdx], opts)
      }

      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  recorder.stop()
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })
  // ensure stream tracks released
  stream.getTracks().forEach((t) => t.stop())

  const blob = new Blob(chunks, { type: mimeType })
  const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
  return { blob, mimeType, ext }
}

function pickMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch {
      /* keep trying */
    }
  }
  return null
}

function loadImage(p: CapturedPhoto): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = p.dataUrl
  })
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, opts: LivePhotoOpts) {
  // Paper background
  ctx.fillStyle = opts.theme.compose.paperBg
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)

  // Photo with cover crop
  const ir = img.width / img.height
  const dr = FRAME_W / FRAME_H
  let sx = 0, sy = 0, sw = img.width, sh = img.height
  if (ir > dr) {
    sw = img.height * dr
    sx = (img.width - sw) / 2
  } else {
    sh = img.width / dr
    sy = (img.height - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, PAD, PAD, FRAME_W, FRAME_H)

  // Border applied to the same frame rect as the photo
  const border = getBorder(opts.borderId)
  border.renderCanvas(ctx, {
    x: PAD,
    y: PAD,
    w: FRAME_W,
    h: FRAME_H,
    themeId: opts.theme.id,
  })

  // Subtle scanlines for retro feel
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.fillStyle = '#000'
  for (let y = 0; y < VIDEO_H; y += 3) ctx.fillRect(0, y, VIDEO_W, 1)
  ctx.restore()
}

/** CRT-style channel-change static. `t` ramps 0 → 1 across the transition. */
function drawStatic(ctx: CanvasRenderingContext2D, t: number) {
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
  // Cheap streaky noise — rectangles instead of per-pixel
  for (let i = 0; i < 320; i++) {
    const v = Math.floor(Math.random() * 256)
    ctx.fillStyle = `rgb(${v},${v},${v})`
    const x = Math.random() * VIDEO_W
    const y = Math.random() * VIDEO_H
    ctx.fillRect(x, y, Math.random() * 32 + 4, Math.random() * 3 + 1)
  }
  // Phosphor flash that fades over the transition
  ctx.fillStyle = `rgba(57,255,20,${0.18 * (1 - t)})`
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H)
}
