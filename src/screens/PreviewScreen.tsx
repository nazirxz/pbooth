import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { composeStrip } from '@/lib/compose'
import { uploadComposed } from '@/lib/supabase/photos'
import { dbUpdateSession } from '@/lib/supabase/sessions'

export function PreviewScreen() {
  const photos = useSession((s) => s.photos)
  const template = useSession((s) => s.template)
  const filter = useSession((s) => s.filter)
  const sessionId = useSession((s) => s.sessionId)
  const composed = useSession((s) => s.composed)
  const setComposed = useSession((s) => s.setComposed)
  const reset = useSession((s) => s.reset)

  const [qrImg, setQrImg] = useState<string>('')
  const [uploadState, setUploadState] = useState<'idle' | 'composing' | 'uploading' | 'ready' | 'local-only' | 'error'>('idle')

  useEffect(() => {
    if (composed || photos.length === 0) return
    let cancelled = false

    ;(async () => {
      try {
        setUploadState('composing')
        const blob = await composeStrip({ photos, template, filter })
        if (cancelled) return
        const dataUrl = await blobToDataUrl(blob)

        setUploadState('uploading')
        const publicUrl = sessionId ? await uploadComposed(sessionId, blob) : null

        if (cancelled) return
        setComposed({ blob, dataUrl, publicUrl })

        if (publicUrl) {
          if (sessionId) {
            await dbUpdateSession(sessionId, {
              final_image_url: publicUrl,
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
          }
          const qr = await QRCode.toDataURL(publicUrl, {
            width: 320,
            margin: 1,
            color: { dark: '#1a1412', light: '#f5e6c8' },
          })
          if (!cancelled) {
            setQrImg(qr)
            setUploadState('ready')
          }
        } else {
          setUploadState('local-only')
        }
      } catch (e) {
        console.error('preview compose/upload failed', e)
        if (!cancelled) setUploadState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [composed, photos, template, filter, sessionId, setComposed])

  const download = () => {
    if (!composed) return
    const a = document.createElement('a')
    a.href = composed.dataUrl
    a.download = `pbooth_${Date.now()}.jpg`
    a.click()
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="06" label="PREVIEW" />

      <div className="flex-1 grid grid-cols-[auto_1fr] gap-10 px-14 pb-6 min-h-0">
        <div className="bg-crt-cream p-4 rounded-2xl shadow-[0_0_30px_rgba(245,230,200,0.15)] flex items-center justify-center">
          {composed ? (
            <img src={composed.dataUrl} alt="Composed strip" className="h-full max-h-full object-contain" />
          ) : (
            <div className="w-[280px] h-[380px] grid place-items-center font-crt text-xl text-black/60">
              COMPOSING...
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 justify-center">
          <div className="font-pixel text-5xl text-crt-phosphor rgb-split leading-tight">YOUR STRIP</div>
          <div className="font-crt text-2xl text-crt-cream/80 tracking-widest">
            LOOKING GOOD ✦
          </div>

          <QRPanel state={uploadState} qrImg={qrImg} />

          <div className="flex gap-4 flex-wrap mt-2">
            <TVButton variant="secondary" size="md" onClick={download} disabled={!composed}>
              ⬇ DOWNLOAD
            </TVButton>
            <TVButton variant="primary" size="lg" onClick={reset}>
              ▶ NEW SESSION
            </TVButton>
          </div>
        </div>
      </div>
    </div>
  )
}

function QRPanel({
  state,
  qrImg,
}: {
  state: 'idle' | 'composing' | 'uploading' | 'ready' | 'local-only' | 'error'
  qrImg: string
}) {
  if (state === 'ready' && qrImg) {
    return (
      <div className="flex items-center gap-4 bg-black/40 border-2 border-crt-cream/30 rounded-xl p-4">
        <img src={qrImg} alt="Download QR" className="w-28 h-28 bg-crt-cream rounded" />
        <div className="font-crt text-crt-cream">
          <div className="text-2xl text-crt-phosphor tracking-widest">SCAN TO DOWNLOAD</div>
          <div className="text-lg opacity-80 mt-1">ON YOUR PHONE</div>
        </div>
      </div>
    )
  }
  if (state === 'composing') {
    return <div className="font-crt text-xl text-crt-amber animate-blink tracking-widest">● COMPOSING STRIP...</div>
  }
  if (state === 'uploading') {
    return <div className="font-crt text-xl text-crt-amber animate-blink tracking-widest">● UPLOADING...</div>
  }
  if (state === 'local-only') {
    return <div className="font-crt text-lg text-crt-cream/70 tracking-widest">CLOUD OFFLINE — USE DOWNLOAD</div>
  }
  if (state === 'error') {
    return <div className="font-crt text-lg text-crt-red tracking-widest">● UPLOAD FAILED — USE DOWNLOAD</div>
  }
  return null
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
