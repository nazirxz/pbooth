import type { CapturedPhoto } from '@/state/session-store'

export interface BuildVideoOpts {
  photos: CapturedPhoto[]
  /** Output width in px. Height follows source aspect. Default 1280 (HD). */
  width?: number
  /** Per-frame display time in ms. Default 500. */
  frameDelayMs?: number
  /** How many times the sequence repeats. Default 3 (gives a ~6s loop). */
  loopCount?: number
  /** CSS filter string applied to each frame. Default 'none'. */
  filterCss?: string
  /** If true, mirror horizontally to match selfie preview. Default true. */
  mirror?: boolean
  /** Target video bitrate. Default 2.5 Mbps — sharp at 1280×960. */
  bitsPerSecond?: number
}

export interface BuildVideoResult {
  blob: Blob
  ext: 'webm' | 'mp4'
}

/**
 * Pick the best supported video mime type for MediaRecorder on the host
 * browser. Prefer MP4 (best playback compat on older iOS) when available,
 * otherwise WebM (vp9 → vp8 → default).
 */
function pickMimeType(): { mime: string; ext: 'webm' | 'mp4' } | null {
  if (typeof MediaRecorder === 'undefined') return null
  const candidates: Array<{ mime: string; ext: 'webm' | 'mp4' }> = [
    { mime: 'video/mp4;codecs=avc1.42E01E', ext: 'mp4' },
    { mime: 'video/mp4', ext: 'mp4' },
    { mime: 'video/webm;codecs=vp9', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
  ]
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c
  }
  return null
}

/**
 * Record a short looping "live photo" video from the captured stills.
 *
 * Strategy: draw each photo on a canvas for `frameDelayMs`, loop the
 * sequence `loopCount` times, and capture the whole thing via
 * `canvas.captureStream()` + `MediaRecorder`. Browser-native — no
 * encoder library to ship. Output is true HD with smooth gradients
 * (real chroma subsampling, not GIF's 256-color quantization).
 *
 * For 4 photos × 500ms × 3 loops at 1280×960 + 2.5Mbps, expect:
 *   - Encode time: ~6 seconds (real-time playback, can't be sped up)
 *   - File size: 250–500 KB
 *   - Quality: indistinguishable from source JPEGs
 *
 * The "encode time = playback time" trade-off matters: we kick this off
 * during CaptureScreen's transition so by the time the user finishes
 * looking at PreviewScreen's strip, the live video is already ready.
 */
export async function buildVideoFromPhotos(opts: BuildVideoOpts): Promise<BuildVideoResult> {
  const targetWidth = opts.width ?? 1280
  const delay = opts.frameDelayMs ?? 500
  const loops = opts.loopCount ?? 3
  const filter = opts.filterCss ?? 'none'
  const mirror = opts.mirror ?? true
  const bitrate = opts.bitsPerSecond ?? 2_500_000

  if (opts.photos.length === 0) {
    throw new Error('buildVideoFromPhotos: no photos to encode')
  }

  const supported = pickMimeType()
  if (!supported) {
    throw new Error('buildVideoFromPhotos: MediaRecorder not supported in this browser')
  }

  const t0 = performance.now()
  const ordered = [...opts.photos].sort((a, b) => a.index - b.index)
  const imgs = await Promise.all(ordered.map(loadImage))

  const ratio = imgs[0].width / imgs[0].height
  const width = targetWidth
  const height = Math.round(width / ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('buildVideoFromPhotos: 2d context unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Some browsers refuse to start a recording on a canvas that has never
  // been painted. Lay down a black frame first so captureStream has data.
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType: supported.mime,
    videoBitsPerSecond: bitrate,
  })
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  recorder.start()

  // Draw the sequence `loops` times. requestAnimationFrame keeps the
  // captureStream healthy and pushes a real frame to the encoder each tick.
  const drawFrame = (img: HTMLImageElement) => {
    ctx.save()
    ctx.filter = filter
    if (mirror) {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    drawCover(ctx, img, 0, 0, width, height)
    ctx.restore()
  }

  for (let loop = 0; loop < loops; loop++) {
    for (const img of imgs) {
      drawFrame(img)
      await wait(delay)
    }
  }

  // Give the encoder one last tick to flush, then stop.
  await wait(120)
  recorder.stop()
  await stopped
  stream.getTracks().forEach((t) => t.stop())

  const blob = new Blob(chunks, { type: supported.mime })
  const tEnd = performance.now()

  console.log(
    `[video] ${imgs.length}f × ${loops} loops @ ${width}×${height} ${supported.ext.toUpperCase()} | ` +
    `total ${(tEnd - t0).toFixed(0)}ms · ${(blob.size / 1024).toFixed(0)}KB`,
  )

  return { blob, ext: supported.ext }
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

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
