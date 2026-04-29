import { GIFEncoder, quantize, applyPalette, prequantize } from 'gifenc'
import type { CapturedPhoto } from '@/state/session-store'

export interface BuildGifOpts {
  photos: CapturedPhoto[]
  /** Output frame width in px. Height follows source aspect. Default 360. */
  width?: number
  /** Per-frame display time in ms. Default 600. */
  frameDelayMs?: number
  /** Loop forever (0) or N times. Default 0. */
  loopCount?: number
  /** CSS filter string applied to each frame. Default 'none'. */
  filterCss?: string
  /** If true, mirror horizontally to match selfie preview. Default true. */
  mirror?: boolean
  /** Max colors in the shared palette. Lower = faster + smaller. Default 128. */
  paletteSize?: 64 | 96 | 128 | 192 | 256
}

export interface BuildGifResult {
  blob: Blob
  ext: 'gif'
}

/**
 * Build an animated GIF from the captured stills. Used in place of the old
 * MediaRecorder live clip — same purpose (a moving keepsake) but produced
 * deterministically from the strip's actual frames.
 *
 * Speed strategy: quantize ONCE across a mosaic of all frames so we get a
 * single shared palette, then per-frame only does drawCover + applyPalette
 * (cheap). This is roughly N× faster than quantizing per frame and also
 * shrinks output, since gifenc writes a single global color table.
 */
export async function buildGifFromPhotos(opts: BuildGifOpts): Promise<BuildGifResult> {
  const width = opts.width ?? 360
  const delay = opts.frameDelayMs ?? 600
  const loop = opts.loopCount ?? 0
  const filter = opts.filterCss ?? 'none'
  const mirror = opts.mirror ?? true
  const paletteSize = opts.paletteSize ?? 128

  if (opts.photos.length === 0) {
    throw new Error('buildGifFromPhotos: no photos to encode')
  }

  const ordered = [...opts.photos].sort((a, b) => a.index - b.index)
  const imgs = await Promise.all(ordered.map(loadImage))

  // Use the first image's aspect to size all frames consistently.
  const ratio = imgs[0].width / imgs[0].height
  const height = Math.round(width / ratio)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('buildGifFromPhotos: 2d context unavailable')

  // Render every frame once into pixel buffers. Held in memory only as long
  // as encoding takes — N × width × height × 4 bytes. At defaults that's
  // ~2 MB for 4 frames, fine.
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

  // Build a stitched mosaic of all frames, then quantize ONCE → shared palette.
  // Sampling across all frames keeps colors representative, but we only do the
  // expensive median-cut once instead of N times.
  const mosaic = new Uint8ClampedArray(width * height * frameData.length * 4)
  for (let i = 0; i < frameData.length; i++) {
    mosaic.set(frameData[i], i * frameData[i].length)
  }
  prequantize(mosaic, { roundRGB: 5, oneBitAlpha: false })
  const palette = quantize(mosaic, paletteSize, { format: 'rgb444' })

  const enc = GIFEncoder()
  for (let i = 0; i < frameData.length; i++) {
    const indexed = applyPalette(frameData[i], palette, 'rgb444')
    // Pass palette on the first frame only — gifenc treats it as the global
    // color table; later frames inherit it (smaller file, faster write).
    enc.writeFrame(indexed, width, height, i === 0 ? { palette, delay } : { delay })
  }

  enc.finish()
  const buf = enc.bytes()

  // gifenc only writes the looping extension when we patch the header. The
  // library itself sets loop=0 (infinite) by default, so we just trust that.
  // If a finite loop count is requested, override the NETSCAPE2.0 block.
  const final = loop === 0 ? buf : patchLoopCount(buf, loop)

  // Copy into a fresh ArrayBuffer-backed Uint8Array so the Blob constructor
  // accepts it under TS 5.7's stricter ArrayBufferLike vs ArrayBuffer split.
  const out = new Uint8Array(final.byteLength)
  out.set(final)
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
 * gifenc emits this block at offset ~13 of any multi-frame GIF.
 */
function patchLoopCount(buf: Uint8Array, loops: number): Uint8Array {
  const sig = [0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45] // "NETSCAPE"
  for (let i = 0; i < buf.length - sig.length - 5; i++) {
    let match = true
    for (let j = 0; j < sig.length; j++) {
      if (buf[i + j] !== sig[j]) { match = false; break }
    }
    if (!match) continue
    // Layout: NETSCAPE2.0 (11 bytes) + sub-block size (1) + 0x01 + loop-lo + loop-hi
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
