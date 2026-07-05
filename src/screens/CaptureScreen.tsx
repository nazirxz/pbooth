import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { RetroCountdown } from '@/components/RetroCountdown'
import { appConfig } from '@/config/app-config'
import { useSession } from '@/state/session-store'
import { useTheme } from '@/state/theme-store'
import { createCameraSource } from '@/lib/camera'
import { buildVideoFromPhotos } from '@/lib/video-encoder'

export function CaptureScreen() {
  const goTo = useSession((s) => s.goTo)
  const filter = useSession((s) => s.filter)
  const template = useSession((s) => s.template)
  const addPhoto = useSession((s) => s.addPhoto)
  const clearPhotos = useSession((s) => s.clearPhotos)
  const sessionId = useSession((s) => s.sessionId)
  const photos = useSession((s) => s.photos)
  const setLiveAsset = useSession((s) => s.setLiveAsset)
  const theme = useTheme((s) => s.theme)

  const tmpl = appConfig.templates.find((t) => t.id === template)!
  const frameCount = tmpl.frames

  const videoRef = useRef<HTMLVideoElement>(null)
  const sourceRef = useRef<ReturnType<typeof createCameraSource> | null>(null)
  if (!sourceRef.current) sourceRef.current = createCameraSource()
  const [countdown, setCountdown] = useState<number | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const [flash, setFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [review, setReview] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)

  useEffect(() => {
    clearPhotos()
    setLiveAsset(null)
    setCaptureError(null)
    const src = sourceRef.current
    if (!src) return
    let cancelled = false

    const run = async () => {
      captureLog('session start', {
        sessionId,
        source: src.name,
        template,
        frameCount,
        filter,
        countdownSec: appConfig.capture.countdownSec,
      })

      const stream = await src.start()
      captureLog('camera source started', { source: src.name, stream: describeStream(stream) })
      if (!videoRef.current) throw new Error('Video element is not mounted')
      await attachStreamToVideo(videoRef.current, stream)
      captureLog('video preview ready', describeVideo(videoRef.current))

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) return
        setFrameIdx(i)
        const shotLabel = `${i + 1}/${frameCount}`
        captureLog(`shot ${shotLabel} countdown start`, describeVideo(videoRef.current))
        for (let n = appConfig.capture.countdownSec; n > 0; n--) {
          if (cancelled) return
          setCountdown(n)
          await wait(1000)
        }
        setCountdown(null)
        setFlash(true)
        await wait(120)
        setFlash(false)

        if (!videoRef.current) throw new Error(`Video element disappeared before shot ${shotLabel}`)
        // Show a "saving" state while the tethered JPEG transfers over USB —
        // otherwise the screen just freezes during the unavoidable wait.
        setSaving(true)
        captureLog(`shot ${shotLabel} capture start`, describeVideo(videoRef.current))
        let blob: Blob
        try {
          blob = await src.capture(videoRef.current)
          if (blob.size <= 0) throw new Error(`Shot ${shotLabel} produced an empty image blob`)
        } catch (e) {
          if (cancelled) throw e
          const message = e instanceof Error ? e.message : String(e)
          setCaptureError(`SHOT ${shotLabel} FAILED - CHECK CONSOLE`)
          captureErrorLog(`shot ${shotLabel} failed`, {
            message,
            source: src.name,
            video: describeVideo(videoRef.current),
            stream: describeStream(stream),
          }, e)
          throw e
        } finally {
          if (!cancelled) setSaving(false)
        }
        const dataUrl = URL.createObjectURL(blob)
        if (cancelled) return
        addPhoto({ index: i, blob, dataUrl })
        captureLog(`shot ${shotLabel} saved`, {
          index: i,
          blobBytes: blob.size,
          blobType: blob.type || '(unknown)',
          photosInStore: useSession.getState().photos.map((p) => ({
            index: p.index,
            blobBytes: p.blob.size,
            blobType: p.blob.type || '(unknown)',
          })),
        })

        // Review popup: show the shot before the next one. Confirmation for the
        // customer, and it absorbs the inter-frame gap behind something useful.
        setReview(dataUrl)
        await wait(appConfig.capture.reviewMs)
        if (cancelled) return
        setReview(null)
        await wait(appConfig.capture.delayBetweenFramesMs)
      }

      const captured = useSession.getState().photos
      const missingFrames = Array.from({ length: frameCount }, (_, index) => index).filter(
        (index) => !captured.some((p) => p.index === index && p.blob.size > 0),
      )
      if (missingFrames.length > 0) {
        const message =
          `Capture incomplete: expected ${frameCount} frames, ` +
          `got ${captured.length}; missing indexes ${missingFrames.join(', ')}`
        setCaptureError(`CAPTURE INCOMPLETE ${captured.length}/${frameCount} - CHECK CONSOLE`)
        captureErrorLog('session incomplete', {
          message,
          expectedFrames: frameCount,
          capturedFrames: captured.map((p) => ({
            index: p.index,
            blobBytes: p.blob.size,
            blobType: p.blob.type || '(unknown)',
          })),
          missingFrames,
        })
        throw new Error(message)
      }

      // Camera off the moment shooting is done — the GIF is built from the
      // captured stills downstream, so we don't need a live stream anymore.
      src.stop()
      captureLog('camera source stopped', { source: src.name })

      // Kick off the HD live-photo VIDEO encode in the background while we
      // transition. MediaRecorder runs in real-time (encode time ≈ playback
      // time), so we start as early as possible and let it finish during
      // strip compose/upload on PreviewScreen.
      if (captured.length > 0) {
        const filterCss = theme.filters.find((f) => f.id === filter)?.css ?? 'none'
        void buildVideoFromPhotos({
          photos: captured,
          width: 1280,
          frameDelayMs: 500,
          loopCount: 3,
          filterCss,
        })
          .then((video) => setLiveAsset(video))
          .catch((e) => console.warn('[capture] background video encode failed', e))
      }

      if (!cancelled) {
        captureLog('session complete', {
          expectedFrames: frameCount,
          capturedFrames: useSession.getState().photos.length,
        })
        await wait(200)
        goTo('decorate')
      }
    }

    run().catch((e) => {
      if (cancelled) return
      src.stop()
      const message = e instanceof Error ? e.message : String(e)
      setCaptureError((current) => current ?? 'CAPTURE FAILED - CHECK CONSOLE')
      captureErrorLog('flow failed', { message }, e)
    })
    return () => {
      cancelled = true
      src.stop()
      captureLog('session cleanup', { source: src.name })
    }
  }, [frameCount, addPhoto, clearPhotos, goTo, sessionId, setLiveAsset, filter, theme, template])

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="05" label={`SHOT ${Math.min(frameIdx + 1, frameCount)}/${frameCount}`} />

      <div className="grid grid-cols-[1fr_260px] gap-6 px-10 pb-4 min-h-0">
        <div className="relative border-4 border-crt-bezelLight rounded-2xl overflow-hidden bg-black scanlines min-h-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={clsx('absolute inset-0 w-full h-full object-cover', `filter-${filter}`)}
            style={{ transform: 'scaleX(-1)' }}
          />

          <AnimatePresence mode="wait">
            {countdown !== null && (
              <div key={countdown} className="absolute inset-0 flex items-center justify-center">
                <RetroCountdown value={countdown} durationMs={1000} />
              </div>
            )}
          </AnimatePresence>

          {flash && <div className="absolute inset-0 bg-white animate-pulse" />}

          {saving && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="font-crt text-3xl text-crt-amber tracking-widest animate-pulse">
                SAVING…
              </div>
            </div>
          )}

          {review && (
            <div className="absolute inset-0 bg-black/85 flex items-center justify-center p-6">
              <div className="relative max-h-full overflow-hidden rounded-xl border-4 border-crt-phosphor shadow-[0_0_40px_rgba(57,255,20,0.4)]">
                <img src={review} alt="" className="block max-h-[68vh] w-auto object-contain" />
                <div className="absolute inset-x-0 bottom-0 bg-black/75 py-2 text-center font-crt text-2xl tracking-widest text-crt-phosphor">
                  SHOT {frameIdx + 1}/{frameCount}
                </div>
              </div>
            </div>
          )}

          {captureError && (
            <div className="absolute inset-0 bg-black/90 flex items-center justify-center p-8 text-center">
              <div className="font-crt text-3xl text-crt-red tracking-widest leading-relaxed">
                {captureError}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 items-stretch min-h-0 overflow-y-auto">
          <div className="font-crt text-2xl text-crt-cream tracking-widest text-center shrink-0">
            SHOTS
          </div>

          {Array.from({ length: frameCount }).map((_, i) => {
            const p = photos.find((x) => x.index === i)
            const active = i === frameIdx
            return (
              <div
                key={i}
                className={clsx(
                  'w-full aspect-[4/3] rounded-lg border-4 overflow-hidden bg-black/50 flex items-center justify-center shrink-0',
                  p
                    ? 'border-crt-phosphor'
                    : active
                    ? 'border-crt-amber animate-blink'
                    : 'border-crt-cream/30',
                )}
              >
                {p ? (
                  <img src={p.dataUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="font-crt text-3xl text-crt-cream/40">{i + 1}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function attachStreamToVideo(videoEl: HTMLVideoElement, stream: MediaStream) {
  videoEl.srcObject = stream
  videoEl.muted = true
  videoEl.playsInline = true

  try {
    await videoEl.play()
  } catch (e) {
    console.warn('[capture] video.play() was rejected; waiting for metadata anyway', e)
  }

  await waitForVideoReady(videoEl, 5_000)
}

async function waitForVideoReady(videoEl: HTMLVideoElement, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (videoEl.videoWidth > 0 && videoEl.videoHeight > 0 && videoEl.readyState >= 2) return
    await wait(50)
  }
  throw new Error(
    `Video preview did not become ready within ${timeoutMs}ms ` +
      `(readyState=${videoEl.readyState}, size=${videoEl.videoWidth}x${videoEl.videoHeight})`,
  )
}

function describeVideo(videoEl: HTMLVideoElement | null) {
  if (!videoEl) return null
  return {
    readyState: videoEl.readyState,
    paused: videoEl.paused,
    ended: videoEl.ended,
    currentTime: Number(videoEl.currentTime.toFixed(3)),
    videoWidth: videoEl.videoWidth,
    videoHeight: videoEl.videoHeight,
    clientWidth: videoEl.clientWidth,
    clientHeight: videoEl.clientHeight,
    srcObject: !!videoEl.srcObject,
  }
}

function describeStream(stream: MediaStream | null) {
  if (!stream) return null
  return stream.getTracks().map((track) => ({
    kind: track.kind,
    label: track.label,
    readyState: track.readyState,
    muted: track.muted,
    enabled: track.enabled,
    settings: 'getSettings' in track ? track.getSettings() : null,
  }))
}

function captureLog(message: string, data?: unknown) {
  if (data === undefined) {
    console.info(`[capture] ${message}`)
    return
  }
  console.info(`[capture] ${message}`, data)
}

function captureErrorLog(message: string, data: unknown, error?: unknown) {
  console.error(`[capture] ${message}`, data, error)
}
