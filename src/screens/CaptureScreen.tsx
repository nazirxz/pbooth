import { useEffect, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { RetroCountdown } from '@/components/RetroCountdown'
import { appConfig } from '@/config/app-config'
import { useSession } from '@/state/session-store'
import { createCameraSource } from '@/lib/camera'
import { uploadPhoto } from '@/lib/storage'

export function CaptureScreen() {
  const goTo = useSession((s) => s.goTo)
  const filter = useSession((s) => s.filter)
  const template = useSession((s) => s.template)
  const addPhoto = useSession((s) => s.addPhoto)
  const clearPhotos = useSession((s) => s.clearPhotos)
  const sessionId = useSession((s) => s.sessionId)
  const photos = useSession((s) => s.photos)
  const setLiveAsset = useSession((s) => s.setLiveAsset)

  const tmpl = appConfig.templates.find((t) => t.id === template)!
  const frameCount = tmpl.frames

  const videoRef = useRef<HTMLVideoElement>(null)
  const sourceRef = useRef(createCameraSource())
  const [countdown, setCountdown] = useState<number | null>(null)
  const [frameIdx, setFrameIdx] = useState(0)
  const [flash, setFlash] = useState(false)

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
        const blob = await src.capture(videoRef.current)
        const dataUrl = await blobToDataUrl(blob)
        addPhoto({ index: i, blob, dataUrl })
        if (sessionId) void uploadPhoto(sessionId, i, blob)
        await wait(appConfig.capture.delayBetweenFramesMs)
      }

      // Camera off the moment shooting is done — the GIF is built from the
      // captured stills downstream, so we don't need a live stream anymore.
      src.stop()

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
  }, [frameCount, addPhoto, clearPhotos, goTo, sessionId, setLiveAsset])

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
