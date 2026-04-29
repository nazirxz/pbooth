import { useEffect, useRef, useState } from 'react'
import { Logo } from '@/components/Logo'
import { fetchSharedSession, type SharedSessionData } from './share-data'

interface Props {
  sessionId: string
}

export function SharePage({ sessionId }: Props) {
  const [data, setData] = useState<SharedSessionData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pollCount = useRef(0)

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      try {
        const d = await fetchSharedSession(sessionId)
        if (!mounted) return
        setData(d)
        setError(null)
        // Live video lands a few seconds after the strip — poll until it's there
        // (or 60s of trying) so the customer doesn't need to manually refresh.
        if (!d.liveVideoUrl && pollCount.current < 20) {
          pollCount.current += 1
          timer = setTimeout(tick, 3000)
        }
      } catch (e) {
        if (mounted) setError((e as Error).message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    tick()
    return () => {
      mounted = false
      if (timer) clearTimeout(timer)
    }
  }, [sessionId])

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black text-crt-cream"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)',
        }}
      />

      <div className="relative mx-auto w-full max-w-md px-5 pt-10 pb-16">
        <Header />

        {loading && <Loading />}
        {!loading && error && <ErrorState error={error} />}
        {!loading && !error && data && <Body data={data} />}

        <Footer />
      </div>
    </div>
  )
}

function Header() {
  return (
    <div className="text-center mb-10">
      <Logo variant="white" className="w-44 h-12 mx-auto mb-3" />
      <h1 className="font-pixel text-2xl text-crt-phosphor rgb-split tracking-widest mt-2">
        YOUR PHOTOS
      </h1>
      <div className="font-crt text-base text-crt-cream/60 tracking-[0.3em] mt-3">
        ◆ SESSION READY ◆
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="text-center py-20">
      <div className="font-crt text-2xl text-crt-amber animate-blink tracking-widest">
        ▌ LOADING...
      </div>
    </div>
  )
}

function ErrorState({ error }: { error: string }) {
  const title =
    error === 'SESSION_NOT_FOUND'
      ? 'Session not found'
      : error === 'STORAGE_NOT_CONFIGURED'
      ? 'Storage offline'
      : 'Something went wrong'
  return (
    <div className="text-center py-16">
      <div className="font-pixel text-xl text-crt-red mb-4">● {title.toUpperCase()}</div>
      <div className="font-crt text-base text-crt-cream/70 max-w-xs mx-auto">
        Coba scan ulang QR-nya, atau minta operator booth untuk ngecek.
      </div>
    </div>
  )
}

function Body({ data }: { data: SharedSessionData }) {
  return (
    <div className="space-y-10">
      {data.photos.length > 0 && <RawSection photos={data.photos} sessionId={data.sessionId} />}
      {data.composedUrl && <ComposedSection url={data.composedUrl} sessionId={data.sessionId} />}
      {data.liveVideoUrl ? (
        <LiveSection url={data.liveVideoUrl} sessionId={data.sessionId} />
      ) : (
        <LivePending />
      )}
      {data.createdAt && (
        <div className="font-crt text-sm text-crt-cream/40 text-center tracking-widest">
          {new Date(data.createdAt).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).toUpperCase()}
        </div>
      )}
    </div>
  )
}

function ComposedSection({ url, sessionId }: { url: string; sessionId: string }) {
  return (
    <section>
      <SectionTitle channel="02">PHOTO + BORDER</SectionTitle>
      <div className="bg-crt-cream rounded-xl p-3 shadow-[0_0_30px_rgba(245,230,200,0.15)] mb-4">
        <img
          src={url}
          alt="Composed strip"
          className="block w-full h-auto rounded"
          loading="lazy"
        />
      </div>
      <DownloadLink href={url} filename={`pbooth_${sessionId.slice(0, 8)}_strip.jpg`}>
        ⬇ DOWNLOAD STRIP
      </DownloadLink>
    </section>
  )
}

function LiveSection({ url, sessionId }: { url: string; sessionId: string }) {
  const ext = url.match(/\.(\w+)(?:\?|$)/)?.[1]?.toLowerCase() ?? 'gif'
  const isVideo = ext === 'webm' || ext === 'mp4'
  return (
    <section>
      <SectionTitle channel="03">LIVE PHOTO</SectionTitle>
      <div className="bg-black rounded-xl border-2 border-crt-cream/30 overflow-hidden mb-4">
        {isVideo ? (
          <video
            src={url}
            controls
            playsInline
            autoPlay
            loop
            muted
            className="block w-full h-auto"
          />
        ) : (
          <img
            src={url}
            alt="Live photo GIF"
            className="block w-full h-auto"
            loading="lazy"
          />
        )}
      </div>
      <DownloadLink href={url} filename={`pbooth_${sessionId.slice(0, 8)}_live.${ext}`}>
        ⬇ DOWNLOAD LIVE PHOTO
      </DownloadLink>
      <p className="font-crt text-sm text-crt-cream/50 mt-3 text-center leading-snug">
        Format {ext.toUpperCase()} · simpan ke galeri & share langsung
      </p>
    </section>
  )
}

function LivePending() {
  return (
    <section>
      <SectionTitle channel="03">LIVE PHOTO</SectionTitle>
      <div className="bg-black/40 border-2 border-dashed border-crt-cream/30 rounded-xl p-6 text-center">
        <div className="font-crt text-lg text-crt-amber animate-blink tracking-widest mb-1">
          ▌ ENCODING...
        </div>
        <div className="font-crt text-sm text-crt-cream/60">
          Refresh halaman ini sebentar lagi
        </div>
      </div>
    </section>
  )
}

function RawSection({ photos, sessionId }: { photos: SharedSessionData['photos']; sessionId: string }) {
  return (
    <section>
      <SectionTitle channel="01">RAW PHOTOS</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((p) => (
          <div key={p.index} className="space-y-2">
            <a href={p.url} target="_blank" rel="noopener noreferrer">
              <img
                src={p.url}
                alt={`Frame ${p.index + 1}`}
                className="block w-full aspect-[4/3] object-cover rounded-md border-2 border-crt-cream/30"
                loading="lazy"
              />
            </a>
            <DownloadLink
              href={p.url}
              filename={`pbooth_${sessionId.slice(0, 8)}_frame_${p.index + 1}.jpg`}
              compact
            >
              ⬇ FRAME {p.index + 1}
            </DownloadLink>
          </div>
        ))}
      </div>
      <p className="font-crt text-sm text-crt-cream/50 mt-4 text-center leading-snug">
        Di iPhone? Tap & tahan foto → <span className="text-crt-cream/80">"Save Image"</span>
      </p>
    </section>
  )
}

function SectionTitle({ channel, children }: { channel: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="font-crt text-xs text-crt-cream/40 tracking-widest border border-crt-cream/30 px-2 py-0.5 rounded-sm">
        CH {channel}
      </span>
      <h2 className="font-pixel text-lg text-crt-phosphor rgb-split tracking-widest">{children}</h2>
    </div>
  )
}

function DownloadLink({
  href,
  filename,
  children,
  compact,
}: {
  href: string
  filename: string
  children: React.ReactNode
  compact?: boolean
}) {
  return (
    <a
      href={href}
      download={filename}
      target="_blank"
      rel="noopener noreferrer"
      className={
        compact
          ? 'block text-center font-pixel text-xs tracking-widest bg-crt-bezel text-crt-cream border-2 border-crt-cream/40 rounded-md py-2 hover:bg-crt-cream/10'
          : 'block text-center font-pixel text-base tracking-widest bg-crt-phosphor text-black border-2 border-crt-phosphor rounded-lg py-3 shadow-[0_0_20px_rgba(57,255,20,0.45)]'
      }
    >
      {children}
    </a>
  )
}

function Footer() {
  return (
    <div className="mt-12 text-center">
      <Logo variant="white" className="w-32 h-9 mx-auto mb-2" />
      <p className="font-crt text-xs text-crt-cream/40 tracking-widest">
        ◆ POWERED BY EUORNA · {new Date().getFullYear()} ◆
      </p>
    </div>
  )
}
