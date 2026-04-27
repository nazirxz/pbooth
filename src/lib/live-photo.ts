/**
 * Live photo = a continuous video clip recorded from the webcam during the
 * capture session — same idea as iPhone's Live Photo. It is not a slideshow
 * of the still frames; it is the actual moment the customer was being shot.
 *
 * Usage: start() returns a controller bound to the live MediaStream. Call
 * stop() after the last shutter; the resolved blob is the finished clip.
 *
 * The stream we record is a mirrored canvas (not the raw camera) so the
 * playback orientation matches what the customer saw on the kiosk monitor
 * and what the strip stills look like.
 */

export interface LiveRecordingResult {
  blob: Blob
  ext: 'webm' | 'mp4'
}

export interface LiveRecorder {
  stop(): Promise<LiveRecordingResult>
  cancel(): void
}

export interface StartLiveRecorderOpts {
  videoEl: HTMLVideoElement
  width: number
  height: number
}

export function startLiveRecorder(opts: StartLiveRecorderOpts): LiveRecorder | null {
  const mimeType = pickVideoMimeType()
  if (!mimeType) {
    console.warn('[live-photo] no compatible MediaRecorder mime type — skipping')
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = opts.width
  canvas.height = opts.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    console.warn('[live-photo] canvas 2d context unavailable')
    return null
  }

  let drawing = true
  const drawLoop = () => {
    if (!drawing) return
    if (opts.videoEl.readyState >= 2 && opts.videoEl.videoWidth > 0) {
      ctx.save()
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(opts.videoEl, 0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    requestAnimationFrame(drawLoop)
  }
  requestAnimationFrame(drawLoop)

  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000,
  })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data)
  }

  let stopped = false
  recorder.start(150)

  const cleanupStream = () => {
    drawing = false
    stream.getTracks().forEach((t) => t.stop())
  }

  return {
    async stop(): Promise<LiveRecordingResult> {
      if (stopped) throw new Error('recorder already stopped')
      stopped = true
      await new Promise<void>((resolve) => {
        recorder.onstop = () => resolve()
        recorder.stop()
      })
      cleanupStream()
      const ext: 'webm' | 'mp4' = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
      return { blob: new Blob(chunks, { type: mimeType }), ext }
    },
    cancel(): void {
      if (stopped) return
      stopped = true
      try { recorder.stop() } catch { /* noop */ }
      cleanupStream()
    },
  }
}

function pickVideoMimeType(): string | null {
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
