import { useCallback, useEffect, useState } from 'react'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { dbUpdateSession } from '@/lib/supabase/sessions'

const READ_SECONDS = 20

export function InstructionsScreen() {
  const goTo = useSession((s) => s.goTo)
  const sessionId = useSession((s) => s.sessionId)
  const [remaining, setRemaining] = useState(READ_SECONDS)

  const beginCapture = useCallback(() => {
    if (sessionId) void dbUpdateSession(sessionId, { status: 'capturing' })
    goTo('capture')
  }, [goTo, sessionId])

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t)
          beginCapture()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [beginCapture])

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="02" label="PERHATIAN" />

      <div className="grid place-items-center px-14 pb-4 min-h-0">
        <div className="max-w-4xl text-center flex flex-col gap-10">
          <div className="font-pixel text-7xl text-crt-amber rgb-split leading-tight animate-crt-flicker whitespace-nowrap">
            PERHATIAN
          </div>

          <div className="bg-black/40 border-4 border-crt-amber/60 rounded-2xl p-10 shadow-[0_0_30px_rgba(255,179,0,0.25)]">
            <div className="font-crt text-4xl text-crt-cream tracking-widest leading-relaxed">
              SETELAH INI WAKTU BERJALAN
            </div>
            <div className="font-pixel text-6xl text-crt-phosphor mt-4">
              5 MENIT
            </div>
            <div className="font-crt text-3xl text-crt-cream/85 tracking-widest mt-6 leading-relaxed">
              DENGAN WAKTU FOTO
            </div>
            <div className="font-pixel text-5xl text-crt-phosphor mt-2">
              5 DETIK / FOTO
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="font-crt text-2xl text-crt-cream/70 tracking-widest">
              LANJUT OTOMATIS DALAM
            </div>
            <div className="font-pixel text-6xl text-crt-amber tabular-nums">
              {String(remaining).padStart(2, '0')}
            </div>
            <TVButton variant="primary" size="lg" onClick={beginCapture}>
              SAYA SIAP ▶
            </TVButton>
          </div>
        </div>
      </div>
    </div>
  )
}
