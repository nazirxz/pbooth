import { useEffect, useRef } from 'react'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { appConfig, type FilterId } from '@/config/app-config'
import { useSession } from '@/state/session-store'
import { createCameraSource } from '@/lib/camera'
import { dbUpdateSession } from '@/lib/supabase/sessions'
import clsx from 'clsx'

export function FilterScreen() {
  const goTo = useSession((s) => s.goTo)
  const filter = useSession((s) => s.filter)
  const setFilter = useSession((s) => s.setFilter)
  const sessionId = useSession((s) => s.sessionId)
  const videoRef = useRef<HTMLVideoElement>(null)
  const sourceRef = useRef(createCameraSource())

  const start = async () => {
    if (sessionId) await dbUpdateSession(sessionId, { filter_id: filter, status: 'capturing' })
    goTo('capture')
  }

  useEffect(() => {
    const src = sourceRef.current
    src
      .start()
      .then((stream) => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
      .catch((e) => console.error('camera start failed', e))
    return () => src.stop()
  }, [])

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="04" label="FILTER" />

      <div className="grid grid-cols-[1fr_320px] gap-6 px-10 pb-4 min-h-0">
        <div className="grid grid-rows-[auto_1fr_auto] gap-3 min-h-0">
          <div className="font-pixel text-3xl text-crt-phosphor rgb-split">PICK A VIBE</div>

          <div className="relative border-4 border-crt-bezelLight rounded-2xl overflow-hidden bg-black scanlines min-h-0">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={clsx('absolute inset-0 w-full h-full object-cover', `filter-${filter}`)}
              style={{ transform: 'scaleX(-1)' }}
            />
          </div>

          <div className="flex justify-end items-center">
            <TVButton variant="primary" size="lg" onClick={start}>
              START ▶
            </TVButton>
          </div>
        </div>

        <div className="flex flex-col gap-2 min-h-0 overflow-y-auto pr-1">
          {appConfig.filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as FilterId)}
              className={clsx(
                'touch-press border-4 rounded-xl py-4 font-crt text-2xl tracking-widest shrink-0',
                filter === f.id
                  ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.4)]'
                  : 'border-crt-cream/30 bg-black/40 text-crt-cream',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
