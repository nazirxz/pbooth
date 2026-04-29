import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useSession } from '@/state/session-store'

const SESSION_DURATION_MS = 5 * 60 * 1000   // 5 minutes — pre-preview flow
const PREVIEW_DURATION_MS = 3 * 60 * 1000   // 3 minutes — print/wait window on PreviewScreen
const WARNING_AT_MS = 60 * 1000              // amber when ≤ 1 min remaining
const CRITICAL_AT_MS = 15 * 1000             // red when ≤ 15 sec remaining

/**
 * Top-right HUD that counts down the customer's session.
 *  - Pre-preview: 5 minutes from paidAt.
 *  - On PreviewScreen: switches to a 3-minute print-wait window starting from
 *    `previewStartedAt`. PreviewScreen itself handles auto-return to home
 *    when this expires.
 */
export function SessionTimer() {
  const paidAt = useSession((s) => s.paidAt)
  const previewStartedAt = useSession((s) => s.previewStartedAt)
  const [now, setNow] = useState(() => Date.now())

  const active = previewStartedAt ?? paidAt
  const duration = previewStartedAt ? PREVIEW_DURATION_MS : SESSION_DURATION_MS

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [active])

  if (!active) return null

  const remaining = Math.max(0, duration - (now - active))
  const totalSec = Math.floor(remaining / 1000)
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')

  const expired = remaining === 0
  const isCritical = !expired && remaining <= CRITICAL_AT_MS
  const isWarning = !isCritical && !expired && remaining <= WARNING_AT_MS

  return (
    <div className="absolute top-3 right-4 z-50 pointer-events-none">
      <div
        className={clsx(
          'flex items-center gap-2 font-crt px-3.5 py-1.5 rounded-lg backdrop-blur-sm border-2 bg-black/75',
          expired && 'border-crt-red shadow-[0_0_18px_rgba(255,59,48,0.7)]',
          isCritical && 'border-crt-red shadow-[0_0_14px_rgba(255,59,48,0.55)] animate-pulse',
          isWarning && 'border-crt-amber shadow-[0_0_10px_rgba(255,179,0,0.4)]',
          !expired && !isCritical && !isWarning && 'border-crt-cream/50',
        )}
      >
        <span
          className={clsx(
            'w-2 h-2 rounded-full',
            expired
              ? 'bg-crt-red'
              : isCritical
              ? 'bg-crt-red animate-blink'
              : isWarning
              ? 'bg-crt-amber animate-blink'
              : 'bg-crt-phosphor animate-blink',
          )}
        />
        <span
          className={clsx(
            'text-2xl tabular-nums font-bold tracking-wider',
            expired || isCritical
              ? 'text-crt-red'
              : isWarning
              ? 'text-crt-amber'
              : 'text-crt-phosphor',
          )}
        >
          {mm}:{ss}
        </span>
      </div>
    </div>
  )
}
