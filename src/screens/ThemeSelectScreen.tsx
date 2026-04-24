import { motion } from 'framer-motion'
import clsx from 'clsx'
import { themes } from '@/themes'
import type { Theme, ThemeId } from '@/themes'
import { useTheme } from '@/state/theme-store'
import { useSession } from '@/state/session-store'

export function ThemeSelectScreen() {
  const setTheme = useTheme((s) => s.setTheme)
  const currentId = useTheme((s) => s.themeId)
  const goTo = useSession((s) => s.goTo)

  const pick = (id: ThemeId) => {
    setTheme(id)
    // small delay so the theme transition can register visually
    setTimeout(() => goTo('home'), 240)
  }

  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ background: '#0a0a0a' }}
    >
      <div className="flex items-center justify-between px-12 pt-8 pb-4">
        <div className="text-3xl font-mono tracking-[0.3em] text-white/70">PICK YOUR VIBE</div>
        <div className="text-xl font-mono tracking-widest text-white/40">01 / SELECT</div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-8 px-12 pb-12 min-h-0">
        {(Object.values(themes) as Theme[]).map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            selected={currentId === t.id}
            onPick={() => pick(t.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ThemeCard({
  theme,
  selected,
  onPick,
}: {
  theme: Theme
  selected: boolean
  onPick: () => void
}) {
  const { preview } = theme
  const isY2k = theme.id === 'y2k'

  return (
    <motion.button
      onClick={onPick}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={clsx(
        'touch-press relative rounded-3xl overflow-hidden border-4 text-left h-full flex flex-col justify-end',
        selected ? 'border-white shadow-[0_0_40px_rgba(255,255,255,0.3)]' : 'border-white/15',
      )}
      style={{ background: preview.background }}
    >
      {/* Decorative overlays */}
      {isY2k && (
        <>
          <div className="pointer-events-none absolute top-8 right-10 text-white/80 text-6xl" style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.6))' }}>✦</div>
          <div className="pointer-events-none absolute top-28 left-16 text-white/70 text-4xl" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' }}>✧</div>
          <div className="pointer-events-none absolute top-1/2 right-1/4 text-white/60 text-3xl">♡</div>
          <div className="pointer-events-none absolute inset-0 backdrop-blur-[2px]" />
        </>
      )}
      {!isY2k && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px)',
          }}
        />
      )}

      <div className={clsx(
        'relative z-10 p-8',
        isY2k ? 'text-purple-950' : 'text-crt-cream',
      )}>
        <div
          className={clsx('text-sm tracking-[0.4em] uppercase opacity-75 mb-2')}
          style={{ fontFamily: isY2k ? theme.fonts.body : theme.fonts.mono }}
        >
          {preview.tagline}
        </div>
        <div
          className={clsx(
            'leading-none mb-5',
            isY2k ? 'text-6xl font-extrabold' : 'text-5xl rgb-split',
          )}
          style={{ fontFamily: theme.fonts.display }}
        >
          {preview.title}
        </div>
        <div className="flex flex-wrap gap-2 mb-5">
          {preview.vibe.map((v) => (
            <span
              key={v}
              className={clsx(
                'px-3 py-1 text-sm rounded-full border tracking-wider',
                isY2k
                  ? 'border-purple-900/30 bg-white/50 text-purple-950'
                  : 'border-crt-cream/40 bg-black/30 text-crt-cream',
              )}
              style={{ fontFamily: theme.fonts.body }}
            >
              {v}
            </span>
          ))}
        </div>
        <div
          className={clsx(
            'inline-block px-6 py-3 font-bold tracking-widest border-2 rounded-full',
            isY2k
              ? 'bg-white text-pink-600 border-pink-500 shadow-[0_8px_24px_rgba(255,79,161,0.4)]'
              : 'bg-crt-phosphor text-black border-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.5)]',
          )}
          style={{ fontFamily: theme.fonts.display }}
        >
          ▶ CHOOSE
        </div>
      </div>
    </motion.button>
  )
}
