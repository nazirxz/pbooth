import { useEffect, useRef } from 'react'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { appConfig, type FilterId } from '@/config/app-config'
import { useSession } from '@/state/session-store'
import { createCameraSource } from '@/lib/camera'
import clsx from 'clsx'

export function FilterScreen() {
  const goTo = useSession((s) => s.goTo)
  const filter = useSession((s) => s.filter)
  const setFilter = useSession((s) => s.setFilter)
  const videoRef = useRef<HTMLVideoElement>(null)
  const sourceRef = useRef(createCameraSource())

  useEffect(() => {
    const src = sourceRef.current
    src.start().then((stream) => {
      if (videoRef.current) videoRef.current.srcObject = stream
    }).catch((e) => console.error('camera start failed', e))
    return () => src.stop()
  }, [])

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="04" label="FILTER" />

      <div className="flex-1 flex flex-col items-center px-8 gap-6">
        <div className="font-pixel text-4xl text-crt-phosphor rgb-split mt-2">PICK A VIBE</div>

        <div className="relative w-full aspect-[4/3] border-4 border-crt-bezelLight rounded-2xl overflow-hidden bg-black scanlines">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={clsx('w-full h-full object-cover', `filter-${filter}`)}
            style={{ transform: 'scaleX(-1)' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-4 w-full">
          {appConfig.filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id as FilterId)}
              className={clsx(
                'touch-press border-4 rounded-xl py-4 font-crt text-2xl tracking-widest',
                filter === f.id
                  ? 'border-crt-phosphor bg-crt-phosphor/15 text-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.4)]'
                  : 'border-crt-cream/30 bg-black/40 text-crt-cream',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-auto mb-8 flex gap-6 w-full justify-between">
          <TVButton variant="ghost" size="md" onClick={() => goTo('template')}>
            ◀ BACK
          </TVButton>
          <TVButton variant="primary" size="lg" onClick={() => goTo('capture')}>
            START ▶
          </TVButton>
        </div>
      </div>
    </div>
  )
}
