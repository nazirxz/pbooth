import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { useTheme } from '@/state/theme-store'
import { useDecoration } from '@/state/decoration-store'
import { composeStrip } from '@/lib/compose'
import { uploadComposed, uploadLiveAsset } from '@/lib/supabase/photos'
import { dbUpdateSession } from '@/lib/supabase/sessions'
import { appConfig } from '@/config/app-config'
import { buildGifFromPhotos } from '@/lib/gif-encoder'

type UploadState =
  | 'idle'
  | 'composing'
  | 'uploading'
  | 'uploaded'
  | 'local-only'
  | 'error'

type LiveState = 'idle' | 'encoding' | 'uploading' | 'ready' | 'error'

export function PreviewScreen() {
  const photos = useSession((s) => s.photos)
  const template = useSession((s) => s.template)
  const filter = useSession((s) => s.filter)
  const sessionId = useSession((s) => s.sessionId)
  const composed = useSession((s) => s.composed)
  const setComposed = useSession((s) => s.setComposed)
  const liveAsset = useSession((s) => s.liveAsset)
  const setLiveAsset = useSession((s) => s.setLiveAsset)
  const reset = useSession((s) => s.reset)
  const startPreviewCountdown = useSession((s) => s.startPreviewCountdown)
  const theme = useTheme((s) => s.theme)
  const borderId = useDecoration((s) => s.borderId)
  const placedStickers = useDecoration((s) => s.stickers)

  const [qrImg, setQrImg] = useState<string>('')
  const [shareUrl, setShareUrl] = useState<string>('')
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [liveState, setLiveState] = useState<LiveState>('idle')
  const [liveError, setLiveError] = useState<string | null>(null)

  // 3-minute "waiting for print" window — kicks the session timer into preview
  // mode and auto-returns to the welcome screen when it expires.
  useEffect(() => {
    startPreviewCountdown()
    const t = setTimeout(() => reset(), 3 * 60 * 1000)
    return () => clearTimeout(t)
  }, [startPreviewCountdown, reset])

  // Generate the QR as soon as we have a sessionId — independent of upload
  // status. The share page works the moment the row + photos hit Supabase,
  // and re-fetches itself if the user reloads, so customers can scan early.
  useEffect(() => {
    if (!sessionId) return
    const base = appConfig.share.baseUrl || window.location.origin
    const url = `${base}/s/${sessionId}`
    setShareUrl(url)
    let cancelled = false
    QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#1a1412', light: '#f5e6c8' },
    })
      .then((q) => {
        if (!cancelled) setQrImg(q)
      })
      .catch((e) => console.warn('QR encode failed', e))
    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Compose strip + upload + build the GIF live photo from the captured stills
  useEffect(() => {
    if (composed || photos.length === 0) return
    let cancelled = false

    ;(async () => {
      try {
        setUploadState('composing')
        const blob = await composeStrip({
          photos,
          template,
          filterId: filter,
          theme,
          decoration: { borderId, stickers: placedStickers },
        })
        if (cancelled) return
        const dataUrl = await blobToDataUrl(blob)

        setUploadState('uploading')
        const publicUrl = sessionId ? await uploadComposed(sessionId, blob) : null
        if (cancelled) return

        setComposed({ blob, dataUrl, publicUrl })

        if (publicUrl && sessionId) {
          await dbUpdateSession(sessionId, {
            final_image_url: publicUrl,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          setUploadState('uploaded')

          // GIF is normally already encoded in the background by DecorateScreen
          // — if so, skip straight to upload. Fallback to encoding here for
          // the unlikely case where the user blew through decorate too fast.
          setLiveError(null)
          void (async () => {
            try {
              let gif = liveAsset
              if (!gif) {
                setLiveState('encoding')
                const filterCss = theme.filters.find((f) => f.id === filter)?.css ?? 'none'
                gif = await buildGifFromPhotos({
                  photos,
                  frameDelayMs: 600,
                  filterCss,
                })
                if (cancelled) return
                setLiveAsset(gif)
              }

              setLiveState('uploading')
              const liveUrl = await uploadLiveAsset(sessionId, gif.blob, gif.ext)
              if (!liveUrl) {
                setLiveState('error')
                setLiveError('upload failed (cek bucket "composed" + storage policy)')
                return
              }
              const res = await dbUpdateSession(sessionId, { live_video_url: liveUrl })
              if (!res.ok) {
                setLiveState('error')
                setLiveError(res.error ?? 'db update failed')
                return
              }
              setLiveState('ready')
            } catch (e) {
              console.warn('live gif build/upload failed', e)
              setLiveState('error')
              setLiveError((e as Error)?.message ?? String(e))
            }
          })()
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
  }, [composed, photos, template, filter, sessionId, setComposed, theme, borderId, placedStickers, liveAsset, setLiveAsset])

  const download = () => {
    if (!composed) return
    const a = document.createElement('a')
    a.href = composed.dataUrl
    a.download = `pbooth_${Date.now()}.jpg`
    a.click()
  }

  return (
    <div className="absolute inset-0 grid grid-rows-[auto_1fr]">
      <ChannelBar channel="06" label="PREVIEW" />

      <div className="grid grid-cols-[auto_1fr] gap-10 px-14 pb-4 min-h-0">
        <div className="h-full bg-crt-cream p-3 rounded-2xl shadow-[0_0_30px_rgba(245,230,200,0.15)] flex items-center justify-center overflow-hidden">
          {composed ? (
            <img
              src={composed.dataUrl}
              alt="Composed strip"
              className="block h-full w-auto object-contain"
            />
          ) : (
            <div className="w-[260px] h-[360px] grid place-items-center font-crt text-xl text-black/60">
              COMPOSING...
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 justify-center min-w-0">
          <div className="font-pixel text-5xl text-crt-phosphor rgb-split leading-tight">YOUR STRIP</div>
          <div className="font-crt text-2xl text-crt-amber/90 tracking-widest animate-blink">
            ● WAITING FOR YOUR PHOTO
          </div>
          <div className="font-crt text-base text-crt-cream/65 tracking-widest -mt-4">
            (NUNGGU PRINT)
          </div>

          <QRPanel state={uploadState} qrImg={qrImg} sessionId={sessionId} shareUrl={shareUrl} />

          <LiveStatus state={liveState} error={liveError} />

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
  sessionId,
  shareUrl,
}: {
  state: UploadState
  qrImg: string
  sessionId: string | null
  shareUrl: string
}) {
  // Show QR as soon as we have one — the share page handles partial state.
  if (qrImg && sessionId) {
    return (
      <div className="bg-black/40 border-2 border-crt-cream/30 rounded-xl p-4 flex flex-col gap-3 max-w-md">
        <div className="flex items-center gap-4">
          <img src={qrImg} alt="Download QR" className="w-28 h-28 bg-crt-cream rounded" />
          <div className="font-crt text-crt-cream">
            <div className="text-2xl text-crt-phosphor tracking-widest">SCAN UNTUK FOTO</div>
            <div className="text-lg opacity-80 mt-1">RAW + STRIP + LIVE</div>
            <UploadStatusInline state={state} />
          </div>
        </div>
        {shareUrl && (
          <div className="border-t border-crt-cream/15 pt-2">
            <div className="font-crt text-xs text-crt-cream/40 tracking-widest mb-1">
              ATAU BUKA LINK INI
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block font-mono text-xs text-crt-amber/85 break-all leading-snug select-text touch-press"
              style={{ pointerEvents: 'auto' }}
            >
              {shareUrl}
            </a>
          </div>
        )}
      </div>
    )
  }
  if (state === 'composing') {
    return <div className="font-crt text-xl text-crt-amber animate-blink tracking-widest">● COMPOSING STRIP...</div>
  }
  if (state === 'local-only') {
    return <div className="font-crt text-lg text-crt-cream/70 tracking-widest">CLOUD OFFLINE — USE DOWNLOAD</div>
  }
  if (state === 'error') {
    return <div className="font-crt text-lg text-crt-red tracking-widest">● UPLOAD FAILED — USE DOWNLOAD</div>
  }
  return null
}

function LiveStatus({ state, error }: { state: LiveState; error: string | null }) {
  if (state === 'idle') return null
  const label =
    state === 'encoding' ? '● BUILDING GIF...'
    : state === 'uploading' ? '● UPLOADING GIF...'
    : state === 'ready' ? '● LIVE GIF READY'
    : '● LIVE GIF FAILED'
  const tone =
    state === 'ready' ? 'text-crt-phosphor'
    : state === 'error' ? 'text-crt-red'
    : 'text-crt-amber animate-blink'
  return (
    <div className="font-crt text-base tracking-widest space-y-1">
      <div className={tone}>{label}</div>
      {state === 'error' && error && (
        <div className="text-xs text-crt-red/80 normal-case break-words max-w-md">
          {error}
        </div>
      )}
    </div>
  )
}

function UploadStatusInline({ state }: { state: UploadState }) {
  if (state === 'uploaded') {
    return (
      <div className="text-sm text-crt-phosphor mt-1 tracking-widest">● READY</div>
    )
  }
  if (state === 'uploading' || state === 'composing') {
    return (
      <div className="text-sm text-crt-amber mt-1 tracking-widest animate-blink">● UPLOADING...</div>
    )
  }
  if (state === 'error') {
    return <div className="text-sm text-crt-red mt-1 tracking-widest">● UPLOAD FAILED</div>
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
