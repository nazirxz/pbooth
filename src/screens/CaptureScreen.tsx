import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { RetroCountdown } from '@/components/RetroCountdown'
import { appConfig } from '@/config/app-config'
import { useSession } from '@/state/session-store'
import { useTheme } from '@/state/theme-store'
import { createCameraSource } from '@/lib/camera'
import { uploadPhoto } from '@/lib/storage'
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
  const sourceRef = useRef(createCameraSource())
  const [countdown, setCountdown] = useState<number | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const [flash, setFlash] = useState(false)
  const [saving, setSaving] = useState(false)
  const [review, setReview] = useState<string | null>(null)

  useEffect(() => {
    clearPhotos()
    setLiveAsset(null)
    const src = sourceRef.current
    let cancelled = false

    const run = async () => {
      const stream = await src.start()
      if (videoRef.current) videoRef.current.srcObject = stream
      await wait(500)

      for (let i = 0; i < frameCount; i++) {
        if (cancelled) return
        setFrameIdx(i)
        for (let n = appConfig.capture.countdownSec; n > 0; n--) {
          if (cancelled) return
          setCountdown(n)
          await wait(1000)
        }
        setCountdown(null)
        setFlash(true)
        await wait(120)
        setFlash(false)

        if (!videoRef.current) continue
        // Show a "saving" state while the tethered JPEG transfers over USB —
        // otherwise the screen just freezes during the unavoidable wait.
        setSaving(true)
        const blob = await src.capture(videoRef.current)
        const dataUrl = await blobToDataUrl(blob)
        setSaving(false)
        if (cancelled) return
        addPhoto({ index: i, blob, dataUrl })
        if (sessionId) void uploadPhoto(sessionId, i, blob)

        // Review popup: show the shot before the next one. Confirmation for the
        // customer, and it absorbs the inter-frame gap behind something useful.
        setReview(dataUrl)
        await wait(appConfig.capture.reviewMs)
        if (cancelled) return
        setReview(null)
        await wait(appConfig.capture.delayBetweenFramesMs)
      }

      // Camera off the moment shooting is done — the GIF is built from the
      // captured stills downstream, so we don't need a live stream anymore.
      src.stop()

      // Kick off the HD live-photo VIDEO encode in the background while we
      // transition. MediaRecorder runs in real-time (encode time ≈ playback
      // time), so we start as early as possible and let it finish during
      // strip compose/upload on PreviewScreen.
      const captured = useSession.getState().photos
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
        await wait(200)
        goTo('decorate')
      }
    }

    run().catch((e) => console.error('capture flow error', e))
    return () => {
      cancelled = true
      src.stop()
    }
  }, [frameCount, addPhoto, clearPhotos, goTo, sessionId, setLiveAsset, filter, theme])

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

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
