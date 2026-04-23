import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { appConfig } from '@/config/app-config'
import { getPaymentProvider, simulatePaid } from '@/lib/payment'
import type { PaymentSession, PaymentStatus } from '@/lib/payment'
import { useSession } from '@/state/session-store'

export function PaymentScreen() {
  const goTo = useSession((s) => s.goTo)
  const setPayment = useSession((s) => s.setPayment)
  const [session, setSession] = useState<PaymentSession | null>(null)
  const [qrImg, setQrImg] = useState<string>('')
  const [status, setStatus] = useState<PaymentStatus>('pending')
  const [remainingSec, setRemainingSec] = useState<number>(appConfig.payment.timeoutSec)
  const unsubRef = useRef<() => void>()

  useEffect(() => {
    const provider = getPaymentProvider()
    let mounted = true

    provider.createSession(appConfig.payment.amount).then(async (s) => {
      if (!mounted) return
      setSession(s)
      setPayment(s)
      const img = await QRCode.toDataURL(s.qrString, {
        width: 560,
        margin: 2,
        color: { dark: '#f5e6c8', light: '#00000000' },
      })
      setQrImg(img)
      unsubRef.current = provider.onStatusChange(s.id, (newStatus) => {
        setStatus(newStatus)
        if (newStatus === 'paid') {
          setTimeout(() => goTo('template'), 900)
        }
      })
    })

    return () => {
      mounted = false
      unsubRef.current?.()
    }
  }, [goTo, setPayment])

  useEffect(() => {
    if (!session) return
    const t = setInterval(() => {
      const rem = Math.max(0, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))
      setRemainingSec(rem)
      if (rem <= 0) setStatus('expired')
    }, 1000)
    return () => clearInterval(t)
  }, [session])

  const cancel = async () => {
    if (session) await getPaymentProvider().cancel(session.id)
    goTo('home')
  }

  const mm = String(Math.floor(remainingSec / 60)).padStart(2, '0')
  const ss = String(remainingSec % 60).padStart(2, '0')

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="02" label="PAYMENT" />

      <div className="flex-1 flex flex-col items-center px-10 gap-6">
        <div className="font-pixel text-4xl text-crt-phosphor rgb-split mt-2">SCAN TO PAY</div>
        <div className="font-crt text-2xl text-crt-cream/80 tracking-widest">
          RP {appConfig.payment.amount.toLocaleString('id-ID')}
        </div>

        <div className="relative p-8 bg-crt-cream rounded-2xl shadow-[0_0_40px_rgba(245,230,200,0.15)]">
          {qrImg ? (
            <img
              src={qrImg}
              alt="Payment QR"
              className="w-[560px] h-[560px] object-contain"
              style={{ filter: 'contrast(1.1)' }}
            />
          ) : (
            <div className="w-[560px] h-[560px] grid place-items-center font-crt text-3xl text-black/60">
              GENERATING QR...
            </div>
          )}
          <div className="absolute inset-0 scanlines pointer-events-none rounded-2xl" />
        </div>

        <StatusLine status={status} />

        <div className="font-crt text-2xl text-crt-amber tracking-widest">
          EXPIRES IN {mm}:{ss}
        </div>

        <div className="mt-auto mb-8 flex gap-4 w-full justify-center">
          <TVButton variant="ghost" size="md" onClick={cancel}>
            ✕ CANCEL
          </TVButton>
          {appConfig.payment.devSkipButton && session && status === 'pending' && (
            <TVButton variant="secondary" size="md" onClick={() => simulatePaid(session.id)}>
              DEV: SIMULATE PAID
            </TVButton>
          )}
        </div>
      </div>
    </div>
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
