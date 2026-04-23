import { ChannelBar } from '@/components/ChannelBar'
import { TVButton } from '@/components/TVButton'
import { appConfig, type TemplateId } from '@/config/app-config'
import { useSession } from '@/state/session-store'
import clsx from 'clsx'

export function TemplateScreen() {
  const goTo = useSession((s) => s.goTo)
  const template = useSession((s) => s.template)
  const setTemplate = useSession((s) => s.setTemplate)

  return (
    <div className="absolute inset-0 flex flex-col">
      <ChannelBar channel="03" label="TEMPLATE" />

      <div className="flex-1 flex flex-col items-center px-10 gap-8">
        <div className="font-pixel text-4xl text-crt-phosphor rgb-split mt-2">PICK A LAYOUT</div>

        <div className="w-full grid grid-cols-1 gap-6 mt-4">
          {appConfig.templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id as TemplateId)}
              className={clsx(
                'touch-press relative border-4 rounded-2xl px-8 py-6 text-left font-crt',
                template === t.id
                  ? 'border-crt-phosphor bg-crt-phosphor/10 shadow-[0_0_30px_rgba(57,255,20,0.35)]'
                  : 'border-crt-cream/30 bg-black/40',
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-4xl tracking-widest text-crt-cream">{t.label}</div>
                  <div className="text-xl text-crt-amber mt-1">
                    {t.frames} PHOTOS · {t.layout.toUpperCase()}
                  </div>
                </div>
                <TemplateThumb id={t.id} />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-auto mb-8 flex gap-6 w-full justify-between">
          <TVButton variant="ghost" size="md" onClick={() => goTo('home')}>
            ◀ BACK
          </TVButton>
          <TVButton variant="primary" size="lg" onClick={() => goTo('filter')}>
            NEXT ▶
          </TVButton>
        </div>
      </div>
    </div>
  )
}

function TemplateThumb({ id }: { id: string }) {
  const common = 'w-24 h-32 border-2 border-crt-cream/60 grid gap-1 p-1 bg-black/60'
  if (id === 'strip-4')
    return (
      <div className={clsx(common, 'grid-rows-4')}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-crt-cream/20 rounded-sm" />
        ))}
      </div>
    )
  if (id === 'strip-3')
    return (
      <div className={clsx(common, 'grid-rows-3')}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-crt-cream/20 rounded-sm" />
        ))}
      </div>
    )
  return (
    <div className={clsx(common, 'grid-cols-2 grid-rows-2')}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-crt-cream/20 rounded-sm" />
      ))}
    </div>
  )
}
