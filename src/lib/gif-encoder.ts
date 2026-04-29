import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import type { CapturedPhoto } from '@/state/session-store'

export interface BuildGifOpts {
  photos: CapturedPhoto[]
  /** Output frame width in px. Height follows source aspect. Default 320. */
  width?: number
  /** Per-frame display time in ms. Default 600. */
  frameDelayMs?: number
  /** Loop forever (0) or N times. Default 0. */
  loopCount?: number
  /** CSS filter string applied to each frame. Default 'none'. */
  filterCss?: string
  /** If true, mirror horizontally to match selfie preview. Default true. */
  mirror?: boolean
  /** Max colors in the shared palette. Lower = faster + smaller. Default 96. */
  paletteSize?: 64 | 96 | 128 | 192 | 256
}

export interface BuildGifResult {
  blob: Blob
  ext: 'gif'
}

/**
 * Build an animated GIF from the captured stills.
 *
 * Speed strategy:
 *   1. Quantize ONLY the first frame → reuse its palette for every other
 *      frame. All session photos are the same subject under the same
 *      lighting, so the first frame's palette is representative. This
 *      collapses N median-cut passes into one.
 *   2. ApplyPalette per frame is cheap (nearest-color LUT lookup).
 *   3. Smaller output dimensions + smaller palette keep both encode and
 *      output size tight.
 *
 * For 4 frames at 320 px, this typically completes in 100–200 ms.
 */
export async function buildGifFromPhotos(opts: BuildGifOpts): Promise<BuildGifResult> {
  const width = opts.width ?? 320
  const delay = opts.frameDelayMs ?? 600
  const loop = opts.loopCount ?? 0
  const filter = opts.filterCss ?? 'none'
  const mirror = opts.mirror ?? true
  const paletteSize = opts.paletteSize ?? 96

  if (opts.photos.length === 0) {
    throw new Error('buildGifFromPhotos: no photos to encode')
  }

  const t0 = performance.now()
  const ordered = [...opts.photos].sort((a, b) => a.index - b.index)
  const imgs = await Promise.all(ordered.map(loadImage))

  const ratio = imgs[0].width / imgs[0].height
  const height = Math.round(width / ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('buildGifFromPhotos: 2d context unavailable')

  // Render every frame into a pixel buffer.
  const frameData: Uint8ClampedArray[] = []
  for (const img of imgs) {
    ctx.save()
    ctx.filter = filter
    if (mirror) {
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
    }
    drawCover(ctx, img, 0, 0, width, height)
    ctx.restore()
    frameData.push(ctx.getImageData(0, 0, width, height).data)
  }
  const tDraw = performance.now()

  // One palette, derived from the first frame, reused for every frame.
  const palette = quantize(frameData[0], paletteSize)
  const tQuantize = performance.now()

  const enc = GIFEncoder()
  for (let i = 0; i < frameData.length; i++) {
    const indexed = applyPalette(frameData[i], palette)
    // gifenc takes the palette on the first frame as the global color table;
    // subsequent frames inherit it, which makes the file smaller too.
    enc.writeFrame(indexed, width, height, i === 0 ? { palette, delay } : { delay })
  }
  enc.finish()
  const tEncode = performance.now()

  const buf = enc.bytes()
  const final = loop === 0 ? buf : patchLoopCount(buf, loop)

  // TS 5.7 splits Uint8Array<ArrayBufferLike> vs <ArrayBuffer>; copy into a
  // fresh ArrayBuffer-backed view so Blob accepts it.
  const out = new Uint8Array(final.byteLength)
  out.set(final)

  console.log(
    `[gif] ${frameData.length} frames @ ${width}×${height} | ` +
    `draw ${(tDraw - t0).toFixed(0)}ms · quantize ${(tQuantize - tDraw).toFixed(0)}ms · ` +
    `encode ${(tEncode - tQuantize).toFixed(0)}ms · total ${(tEncode - t0).toFixed(0)}ms · ` +
    `${(out.byteLength / 1024).toFixed(0)}KB`,
  )

  return {
    blob: new Blob([out], { type: 'image/gif' }),
    ext: 'gif',
  }
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

/**
 * Find the NETSCAPE2.0 application extension and rewrite its loop count.
 */
function patchLoopCount(buf: Uint8Array, loops: number): Uint8Array {
  const sig = [0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45] // "NETSCAPE"
  for (let i = 0; i < buf.length - sig.length - 5; i++) {
    let match = true
    for (let j = 0; j < sig.length; j++) {
      if (buf[i + j] !== sig[j]) { match = false; break }
    }
    if (!match) continue
    const loopLoOffset = i + 11 + 2
    const loopHiOffset = loopLoOffset + 1
    if (loopHiOffset >= buf.length) break
    const out = new Uint8Array(buf)
    out[loopLoOffset] = loops & 0xff
    out[loopHiOffset] = (loops >> 8) & 0xff
    return out
  }
  return buf
}
