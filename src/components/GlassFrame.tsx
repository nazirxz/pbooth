import { PropsWithChildren } from 'react'
import clsx from 'clsx'

interface Props {
  className?: string
}

/**
 * Modern Y2K "glass" frame — mesh gradient background + glassmorphism inner panel.
 * Used as the theme-2 equivalent of CRTFrame. Intentionally the same outer
 * surface area as CRTFrame so any screen rendered inside it keeps its layout.
 */
export function GlassFrame({ children, className }: PropsWithChildren<Props>) {
  return (
    <div
      className={clsx(
        'relative w-full h-full overflow-hidden',
        className,
      )}
      style={{
        background:
          'linear-gradient(135deg, #ffb3d9 0%, #c3a4ff 50%, #93e9ff 100%)',
      }}
    >
      {/* Animated mesh blobs */}
      <div
        className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, #ff4fa1, transparent 60%)' }}
      />
      <div
        className="absolute -bottom-32 right-0 w-[620px] h-[620px] rounded-full opacity-55 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00e5ff, transparent 60%)' }}
      />
      <div
        className="absolute top-1/3 left-1/2 w-[420px] h-[420px] rounded-full opacity-35 blur-3xl"
        style={{ background: 'radial-gradient(circle, #fff7a3, transparent 60%)' }}
      />

      {/* Inner glass panel */}
      <div className="absolute inset-[2.5%] rounded-[36px] overflow-hidden backdrop-blur-xl bg-white/20 border border-white/50 shadow-[inset_0_2px_20px_rgba(255,255,255,0.5),0_30px_80px_rgba(255,79,161,0.25)]">
        {/* Sparkle layer */}
        <div className="pointer-events-none absolute inset-0 z-40">
          {SPARKLE_POS.map((p, i) => (
            <div
              key={i}
              className="absolute text-white/90 select-none"
              style={{
                left: p.x,
                top: p.y,
                fontSize: p.size,
                filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.7))',
                animation: `sparkle ${p.dur}s ease-in-out ${p.delay}s infinite`,
              }}
            >
              ✦
            </div>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}

const SPARKLE_POS = [
  { x: '8%', y: '12%', size: 22, dur: 3.2, delay: 0 },
  { x: '82%', y: '18%', size: 18, dur: 3.8, delay: 0.5 },
  { x: '14%', y: '70%', size: 16, dur: 3.4, delay: 1.1 },
  { x: '88%', y: '64%', size: 24, dur: 4.2, delay: 0.2 },
  { x: '44%', y: '8%', size: 14, dur: 3.6, delay: 0.9 },
  { x: '56%', y: '92%', size: 20, dur: 4.0, delay: 1.4 },
  { x: '28%', y: '46%', size: 12, dur: 3.0, delay: 0.3 },
  { x: '72%', y: '38%', size: 14, dur: 3.3, delay: 1.7 },
]
