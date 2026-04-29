import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props {
  /** Current countdown value (e.g. 5, 4, 3, 2, 1). */
  value: number
  /** How long this tick will be on screen, in ms. Drives the pie wipe. */
  durationMs?: number
  /** Disable audio (for environments where it's unwanted). */
  silent?: boolean
}

/**
 * Classic cinema film-leader countdown — cream paper background, two thin
 * black rings, full crosshair, a clockwise pie sweep, a fat serif numeral
 * and a tiny red registration dot. Vignetted corners sell the projector look.
 *
 * Mount with `key={value}` so every tick is a fresh animation.
 */
export function RetroCountdown({ value, durationMs = 1000, silent }: Props) {
  useEffect(() => {
    if (silent) return
    const isFinal = value === 1
    playBeep(isFinal ? 1200 : 800, isFinal ? 0.18 : 0.09)
  }, [value, silent])

  const cx = 100
  const cy = 100
  const rOuter = 92
  const rInner = 84
  const durS = durationMs / 1000

  return (
    <motion.div
      key={value}
      initial={{ scale: 1.05, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="relative pointer-events-none"
    >
      <svg
        viewBox="0 0 200 200"
        className="w-[28rem] h-[28rem] max-w-[90vw] max-h-[60vh]"
      >
        <defs>
          {/* Soft vignette — darker at the corners, like a projected frame. */}
          <radialGradient id="leaderBg" cx="50%" cy="50%" r="68%">
            <stop offset="0%" stopColor="#efe7d6" />
            <stop offset="65%" stopColor="#d8cdb5" />
            <stop offset="100%" stopColor="#3a3128" />
          </radialGradient>
          {/* Subtle grain on the paper using turbulence. */}
          <filter id="leaderGrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0.18 0"
            />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
          {/* Extra corner darkening — overlays the whole frame. */}
          <radialGradient id="leaderEdge" cx="50%" cy="50%" r="75%">
            <stop offset="60%" stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>

        {/* Paper / vignette background */}
        <rect x="0" y="0" width="200" height="200" fill="url(#leaderBg)" />
        <rect x="0" y="0" width="200" height="200" fill="url(#leaderBg)" filter="url(#leaderGrain)" opacity="0.5" />

        {/* Full-width crosshair through the whole frame */}
        <g stroke="#1a1412" strokeWidth="1.4" opacity="0.92">
          <line x1="0" y1={cy} x2="200" y2={cy} />
          <line x1={cx} y1="0" x2={cx} y2="200" />
        </g>

        {/* Clockwise pie wipe — a fat green/black arc drawn on top of the inner
            ring, animated to vanish over the tick. Reads as the projector's
            sweep hand "consuming" the dial. */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={rInner - 4}
          fill="none"
          stroke="rgba(26,20,18,0.22)"
          strokeWidth={(rInner - 4) * 2}
          strokeDasharray={2 * Math.PI * (rInner - 4)}
          transform={`rotate(-90 ${cx} ${cy})`}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: 2 * Math.PI * (rInner - 4) }}
          transition={{ duration: durS, ease: 'linear' }}
        />

        {/* Thin clock-hand that rotates with the wipe */}
        <SweepHand cx={cx} cy={cy} r={rInner - 2} durS={durS} />

        {/* Two concentric thin black rings */}
        <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="#1a1412" strokeWidth="2" />
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="#1a1412" strokeWidth="1.6" />

        {/* Big bold serif numeral */}
        <g
          fontSize="120"
          fontFamily='"Bodoni Moda", "Playfair Display", "DM Serif Display", Georgia, serif'
          fontWeight={900}
          textAnchor="middle"
          dominantBaseline="central"
        >
          <text x={cx} y={cy + 4} fill="#1a1412">
            {value}
          </text>
        </g>

        {/* Tiny red registration dot at 3 o'clock */}
        <circle cx={cx + rInner + 6} cy={cy + 2} r="2.6" fill="#d63b2f" opacity="0.9" />

        {/* Faint corner darkening (extra) */}
        <rect x="0" y="0" width="200" height="200" fill="url(#leaderEdge)" pointerEvents="none" />
      </svg>

      {/* Sweeping scanline across the numeral */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        initial={{ opacity: 0.25 }}
        animate={{ opacity: [0.25, 0.05, 0] }}
        transition={{ duration: 0.45, times: [0, 0.4, 1] }}
      >
        <div
          className="absolute inset-x-0 h-2"
          style={{
            top: '50%',
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.35), transparent)',
            transform: 'translateY(-50%)',
            mixBlendMode: 'multiply',
          }}
        />
      </motion.div>
    </motion.div>
  )
}

/** A thin sweeping "clock hand" that rotates clockwise across the disc. */
function SweepHand({ cx, cy, r, durS }: { cx: number; cy: number; r: number; durS: number }) {
  return (
    <motion.line
      x1={cx}
      y1={cy}
      x2={cx}
      y2={cy - r}
      stroke="#1a1412"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ transformOrigin: `${cx}px ${cy}px` }}
      initial={{ rotate: 0 }}
      animate={{ rotate: 360 }}
      transition={{ duration: durS, ease: 'linear' }}
    />
  )
}

/* Simple synthesized beep using Web Audio API — works without any asset. */
function playBeep(freq: number, duration: number) {
  try {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctx = w.AudioContext ?? w.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = freq
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.14, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)
    osc.start()
    osc.stop(ctx.currentTime + duration)
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    // Autoplay blocked or context creation failed — silent fallback.
  }
}
