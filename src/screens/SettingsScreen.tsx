import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { useDevice } from '@/state/device-store'

export function SettingsScreen() {
  const goTo = useSession((s) => s.goTo)
  const selectedDeviceId = useDevice((s) => s.selectedDeviceId)
  const setSelectedDeviceId = useDevice((s) => s.setSelectedDeviceId)

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(selectedDeviceId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Permission + initial enumerate
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        // Need to request a stream first — Chrome only returns device labels
        // after the user has granted at least one camera permission.
        const probe = await navigator.mediaDevices.getUserMedia({ video: true })
        if (cancelled) {
          probe.getTracks().forEach((t) => t.stop())
          return
        }

        const list = await navigator.mediaDevices.enumerateDevices()
        const video = list.filter((d) => d.kind === 'videoinput')
        setDevices(video)

        // Pick stored device if it still exists, otherwise fall back to whatever
        // the probe gave us (default device).
        const wanted = selectedDeviceId && video.some((d) => d.deviceId === selectedDeviceId)
          ? selectedDeviceId
          : video[0]?.deviceId ?? null
        setActiveId(wanted)

        if (wanted) {
          // Stop the probe and start with the wanted device explicitly
          probe.getTracks().forEach((t) => t.stop())
          await switchTo(wanted, { skipActiveUpdate: true })
        } else {
          streamRef.current = probe
          if (videoRef.current) videoRef.current.srcObject = probe
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setError(msg)
      }
    }

    init()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchTo = async (
    deviceId: string,
    opts: { skipActiveUpdate?: boolean } = {},
  ) => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      if (!opts.skipActiveUpdate) setActiveId(deviceId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setError(`Failed to switch device: ${msg}`)
    }
  }

  const save = () => {
    setSelectedDeviceId(activeId)
    goTo('home')
  }

  const useDefault = () => {
    setSelectedDeviceId(null)
    goTo('home')
  }

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="00" label="SETTINGS" />

      <div className="grid grid-cols-[1fr_360px] gap-6 px-10 pb-4 min-h-0">
        <div className="grid grid-rows-[auto_1fr_auto] gap-3 min-h-0">
          <div className="font-pixel text-3xl text-crt-phosphor rgb-split">CAMERA SETUP</div>

          <div className="relative border-4 border-crt-bezelLight rounded-2xl overflow-hidden bg-black scanlines min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/85 text-center px-8">
                <div className="font-crt text-xl text-crt-red max-w-md leading-snug">
                  ✕ {error}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <TVButton variant="ghost" size="md" onClick={() => goTo('home')}>
              ◀ CANCEL
            </TVButton>
            <div className="flex gap-3">
              <TVButton variant="secondary" size="md" onClick={useDefault}>
                USE DEFAULT
              </TVButton>
              <TVButton variant="primary" size="lg" onClick={save} disabled={!activeId}>
                SAVE ✓
              </TVButton>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 min-h-0">
          <div className="font-crt text-2xl text-crt-cream tracking-widest">
            AVAILABLE DEVICES
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
            {devices.length === 0 && !error && (
              <div className="font-crt text-base text-crt-cream/60 animate-blink">
                ▌ DETECTING...
              </div>
            )}
            {devices.map((d, i) => {
              const label = d.label || `Camera ${i + 1}`
              const selected = activeId === d.deviceId
              const stored = selectedDeviceId === d.deviceId
              return (
                <button
                  key={d.deviceId}
                  onClick={() => switchTo(d.deviceId)}
                  className={clsx(
                    'touch-press text-left px-4 py-3 border-2 rounded-xl font-crt',
                    selected
                      ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor shadow-[0_0_18px_rgba(57,255,20,0.35)]'
                      : 'border-crt-cream/30 bg-black/40 text-crt-cream',
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl mt-0.5">{selected ? '●' : '○'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-lg leading-tight break-words">{label}</div>
                      <div className="text-xs opacity-50 tracking-widest mt-1">
                        {d.deviceId.slice(0, 12)}...
                        {stored && <span className="ml-2 text-crt-amber">SAVED</span>}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <div className="font-crt text-xs text-crt-cream/40 leading-snug">
            Tap kamera untuk preview. SAVE menyimpan pilihan untuk sesi berikutnya.
          </div>
        </div>
      </div>
    </div>
  )
}
