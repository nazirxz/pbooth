import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useSession } from '@/state/session-store'

const SESSION_DURATION_MS = 5 * 60 * 1000   // 5 minutes
const WARNING_AT_MS = 60 * 1000              // amber when ≤ 1 min remaining
const CRITICAL_AT_MS = 15 * 1000             // red when ≤ 15 sec remaining

/**
 * Top-right HUD that counts down the customer's 5-minute paid session.
 * Mounts after `markPaid()` is called and stays visible until the session
 * is reset to home.
 */
export function SessionTimer() {
  const paidAt = useSession((s) => s.paidAt)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!paidAt) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [paidAt])

  if (!paidAt) return null

  const remaining = Math.max(0, SESSION_DURATION_MS - (now - paidAt))
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
        <span className="text-crt-cream/65 text-base tracking-widest">SESI</span>
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
