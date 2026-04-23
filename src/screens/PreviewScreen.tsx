import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { useSession } from '@/state/session-store'
import { appConfig } from '@/config/app-config'
import clsx from 'clsx'

export function PreviewScreen() {
  const photos = useSession((s) => s.photos)
  const template = useSession((s) => s.template)
  const reset = useSession((s) => s.reset)
  const tmpl = appConfig.templates.find((t) => t.id === template)!

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="06" label="PREVIEW" />

      <div className="flex-1 flex flex-col items-center px-8 gap-6">
        <div className="font-pixel text-4xl text-crt-phosphor rgb-split mt-2">YOUR STRIP</div>

        <div
          className={clsx(
            'bg-crt-cream p-6 rounded-2xl shadow-[0_0_30px_rgba(245,230,200,0.15)]',
            'max-h-[60vh] overflow-hidden',
          )}
        >
          <div
            className={clsx(
              'gap-3 grid',
              tmpl.layout === 'grid' ? 'grid-cols-2 grid-rows-2 w-[520px]' : 'grid-cols-1 w-[340px]',
            )}
          >
            {photos.map((p) => (
              <img
                key={p.index}
                src={p.dataUrl}
                alt=""
                className="w-full border-2 border-black/10 rounded"
              />
            ))}
          </div>
          <div className="mt-4 text-center font-pixel text-black/70 text-sm tracking-widest">
            PBOOTH · {new Date().toLocaleDateString('id-ID')}
          </div>
        </div>

        <div className="font-crt text-xl text-crt-amber/80 tracking-widest">
          {/* TODO fase berikutnya: generate QR download URL dari Supabase Storage */}
          QR DOWNLOAD — COMING SOON
        </div>

        <div className="mt-auto mb-8 flex gap-6 w-full justify-center">
          <TVButton variant="primary" size="lg" onClick={reset}>
            ▶ NEW SESSION
          </TVButton>
        </div>
      </div>
    </div>
  )
}
