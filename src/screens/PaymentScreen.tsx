import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import clsx from 'clsx'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { appConfig } from '@/config/app-config'
import { getPaymentProvider, simulatePaid, simulateDokuPaid } from '@/lib/payment'
import type { PaymentSession, PaymentStatus } from '@/lib/payment'
import { useSession } from '@/state/session-store'
import { dbCreateSession, dbUpdateSession } from '@/lib/supabase/sessions'
import { dbCreatePayment, dbUpdatePaymentStatus } from '@/lib/supabase/payments'

type MethodView = 'qris' | 'other'

export function PaymentScreen() {
  const goTo = useSession((s) => s.goTo)
  const setPayment = useSession((s) => s.setPayment)
  const setSessionId = useSession((s) => s.setSessionId)
  const setPaymentRowId = useSession((s) => s.setPaymentRowId)
  const markPaid = useSession((s) => s.markPaid)

  const [session, setSession] = useState<PaymentSession | null>(null)
  const [qrImg, setQrImg] = useState<string>('')
  const [methodView, setMethodView] = useState<MethodView>('qris')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [remainingSec, setRemainingSec] = useState<number>(appConfig.payment.timeoutSec)
  const unsubRef = useRef<() => void>()
  const paymentRowIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // ── 1. bootstrap payment ────────────────────────────────────────────────
  useEffect(() => {
    const provider = getPaymentProvider()
    let mounted = true

    ;(async () => {
      try {
        const row = await dbCreateSession()
        if (!mounted) return
        sessionIdRef.current = row?.id ?? null
        setSessionId(row?.id ?? null)

        const pay = await provider.createSession(appConfig.payment.amount, {
          sessionId: row?.id ?? null,
        })
        if (!mounted) return
        setSession(pay)
        setPayment(pay)

        // Default tab depends on what the provider returned. If we have a
        // QRIS string, start there; otherwise fall back to the URL view.
        if (!isQrisString(pay.qrString) && pay.paymentUrl) {
          setMethodView('other')
        }

        let resolvedRowId: string | null = pay.paymentRowId ?? null
        if (!resolvedRowId) {
          const payRow = await dbCreatePayment({
            sessionId: row?.id ?? null,
            provider: provider.name,
            providerRef: pay.id,
            amount: pay.amount,
            qrString: pay.qrString,
            expiresAt: pay.expiresAt,
          })
          resolvedRowId = payRow?.id ?? null
        }
        if (!mounted) return
        paymentRowIdRef.current = resolvedRowId
        setPaymentRowId(resolvedRowId)
        if (row && resolvedRowId) {
          await dbUpdateSession(row.id, { payment_id: resolvedRowId })
        }

        unsubRef.current = provider.onStatusChange(pay.id, async (newStatus) => {
          setStatus(newStatus)
          if (provider.name !== 'doku' && paymentRowIdRef.current) {
            await dbUpdatePaymentStatus(paymentRowIdRef.current, newStatus)
          }
          if (newStatus === 'paid') {
            markPaid()
            if (sessionIdRef.current) await dbUpdateSession(sessionIdRef.current, { status: 'paid' })
            setTimeout(() => goTo('template'), 900)
          }
        })
      } catch (err) {
        if (!mounted) return
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[PaymentScreen] bootstrap failed:', msg, err)
        setError(msg)
      }
    })()

    return () => {
      mounted = false
      unsubRef.current?.()
    }
  }, [goTo, setPayment, setSessionId, setPaymentRowId, markPaid])

  // ── 2. (re)render QR whenever session or active tab changes ─────────────
  useEffect(() => {
    if (!session) return
    const value = methodView === 'qris' ? session.qrString : session.paymentUrl
    if (!value) return
    let cancelled = false
    QRCode.toDataURL(value, {
      // High error correction so the QR stays scannable even on glossy
      // kiosk screens with reflection. Solid black on white maximises
      // scanner reliability — no CRT colour treatment here.
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 560,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((img) => {
      if (!cancelled) setQrImg(img)
    })
    return () => {
      cancelled = true
    }
  }, [session, methodView])

  // ── 3. countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => {
      const rem = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
      setRemainingSec(rem)
      if (rem <= 0) setStatus('expired')
    }, 1000)
    return () => clearInterval(t)
  }, [session])

  // ── 4. auto-reset to home on terminal failure states ────────────────────
  // When the payment expires, gets cancelled, or fails, the user is no
  // longer able to complete the flow on this screen. Show the status for a
  // brief moment so they can read it, then drop back to the welcome screen
  // so the kiosk is ready for the next customer.
  const reset = useSession((s) => s.reset)
  useEffect(() => {
    if (status !== 'expired' && status !== 'cancelled' && status !== 'failed') return
    const t = setTimeout(() => reset(), 3000)
    return () => clearTimeout(t)
  }, [status, reset])

  const cancel = async () => {
    if (session) await getPaymentProvider().cancel(session.id)
    if (paymentRowIdRef.current) await dbUpdatePaymentStatus(paymentRowIdRef.current, 'cancelled')
    if (sessionIdRef.current) await dbUpdateSession(sessionIdRef.current, { status: 'cancelled' })
    goTo('home')
  }

  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0')
  const ss = String(remainingSec % 60).padStart(2, '0')

  const hasOtherMethods = !!session?.paymentUrl && session.paymentUrl !== session.qrString

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="02" label="PAYMENT" />

      <div className="grid grid-cols-[auto_1fr] items-center gap-12 px-14 pb-4 min-h-0">
        {/* QR panel — keep the cream frame as decoration but render the
            actual QR on a clean white inset with no overlays/filters so
            scanners read it reliably. */}
        <div className="relative p-6 bg-crt-cream rounded-2xl shadow-[0_0_40px_rgba(245,230,200,0.15)]">
          <div className="bg-white rounded-lg p-4 grid place-items-center">
            {error ? (
              <div className="w-[440px] h-[440px] grid place-items-center p-6">
                <div className="text-center">
                  <div className="font-pixel text-3xl text-red-600 mb-4">⚠ ERROR</div>
                  <div className="font-crt text-base text-red-800 leading-relaxed break-words max-w-[380px]">
                    {error}
                  </div>
                  <button
                    onClick={() => { setError(null); window.location.reload() }}
                    className="mt-6 font-pixel text-lg px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
                  >
                    RETRY
                  </button>
                </div>
              </div>
            ) : qrImg ? (
              <img
                src={qrImg}
                alt="Payment QR"
                className="w-[440px] h-[440px] block select-none"
                draggable={false}
              />
            ) : (
              <div className="w-[440px] h-[440px] grid place-items-center font-crt text-2xl text-black/60">
                GENERATING QR...
              </div>
            )}
          </div>

          {/* Acquirer NMID — small label below the QR for QRIS view, mirrors
              what banking apps display when scanning. Helps customers feel
              the QR is legit. */}
          {methodView === 'qris' && session?.nmid && (
            <div className="mt-3 font-crt text-xs text-black/60 tracking-widest text-center">
              NMID {session.nmid}
            </div>
          )}
        </div>

        {/* Right column — title, method tabs, status, controls */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="font-pixel text-5xl text-crt-phosphor rgb-split leading-tight">
              {methodView === 'qris' ? 'SCAN TO PAY' : 'OPEN ON PHONE'}
            </div>
            <div className="mt-3 font-crt text-3xl text-crt-cream/80 tracking-widest">
              RP {appConfig.payment.amount.toLocaleString('id-ID')}
            </div>
            <div className="mt-2 font-crt text-base text-crt-cream/50 tracking-widest">
              {methodView === 'qris'
                ? 'SCAN WITH ANY QRIS-COMPATIBLE BANKING / E-WALLET APP'
                : 'SCAN WITH PHONE CAMERA TO OPEN PAYMENT PAGE'}
            </div>
          </div>

          {hasOtherMethods && (
            <div className="flex gap-2">
              <MethodTab
                active={methodView === 'qris'}
                onClick={() => setMethodView('qris')}
              >
                QRIS
              </MethodTab>
              <MethodTab
                active={methodView === 'other'}
                onClick={() => setMethodView('other')}
              >
                OTHER METHODS
              </MethodTab>
            </div>
          )}

          <StatusLine status={status} />

          <div className="font-crt text-2xl text-crt-amber tracking-widest">
            EXPIRES IN {mm}:{ss}
          </div>

          <div className="flex gap-4 flex-wrap mt-4">
            <TVButton variant="ghost" size="md" onClick={cancel}>
              ✕ CANCEL
            </TVButton>
            {appConfig.payment.devSkipButton && session && status === 'pending' && (
              <TVButton
                variant="secondary"
                size="md"
                onClick={async () => {
                  // Route the dev sim through whichever provider is active.
                  // - mock: in-memory shortcut, fires the listener directly
                  // - doku: edge function flips the row in Supabase, the
                  //         existing Realtime subscription does the rest.
                  if (getPaymentProvider().name === 'doku') {
                    if (paymentRowIdRef.current) {
                      try {
                        await simulateDokuPaid(paymentRowIdRef.current)
                      } catch (err) {
                        console.error('[PaymentScreen] simulateDokuPaid failed', err)
                      }
                    }
                  } else {
                    simulatePaid(session.id)
                  }
                }}
              >
                DEV: SIMULATE PAID
              </TVButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MethodTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'font-pixel tracking-widest uppercase border-4 rounded-xl touch-press',
        'text-xl px-5 py-2 min-h-[52px]',
        active
          ? 'bg-crt-phosphor text-black border-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.5)]'
          : 'bg-transparent text-crt-cream/70 border-crt-cream/30',
      )}
    >
      {children}
    </button>
  )
}

function StatusLine({ status }: { status: PaymentStatus }) {
  if (status === 'paid') {
    return (
      <div className="font-pixel text-3xl text-crt-phosphor rgb-split animate-crt-flicker">
        ● PAID — STARTING...
      </div>
    )
  }
  if (status === 'expired') {
    return <div className="font-pixel text-3xl text-crt-red">● EXPIRED</div>
  }
  if (status === 'cancelled' || status === 'failed') {
    return <div className="font-pixel text-3xl text-crt-red">● {status.toUpperCase()}</div>
  }
  return (
    <div className="font-crt text-3xl text-crt-amber animate-blink tracking-widest">
      ● WAITING FOR PAYMENT...
    </div>
  )
}

/** True if the string looks like an EMV QRIS payload (starts with the
 *  Payload Format Indicator `000201`). Used to decide whether to default
 *  the kiosk to the QRIS tab or the URL tab. */
function isQrisString(s: string): boolean {
  return s.startsWith('000201')
}
