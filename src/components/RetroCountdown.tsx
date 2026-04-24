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
 * Film-leader style countdown: big numeral + reticle + clockwise pie wipe +
 * chromatic aberration, with a short retro "beep" on every tick.
 *
 * Designed to be mounted with `key={value}` so each tick is a fresh animation
 * and the wipe restarts cleanly.
 */
export function RetroCountdown({ value, durationMs = 1000, silent }: Props) {
  useEffect(() => {
    if (silent) return
    const isFinal = value === 1
    playBeep(isFinal ? 1200 : 800, isFinal ? 0.18 : 0.09)
  }, [value, silent])

  const r = 85
  const circumference = 2 * Math.PI * r
  const durS = durationMs / 1000

  return (
    <motion.div
      key={value}
      initial={{ scale: 1.7, opacity: 0, filter: 'blur(8px) brightness(3)' }}
      animate={{ scale: 1, opacity: 1, filter: 'blur(0px) brightness(1)' }}
      exit={{ scale: 0.55, opacity: 0, filter: 'blur(4px) brightness(2)' }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="relative pointer-events-none"
    >
      <svg
        viewBox="0 0 200 200"
        className="w-[28rem] h-[28rem] max-w-[90vw] max-h-[60vh]"
        style={{ filter: 'drop-shadow(0 0 28px rgba(57,255,20,0.55))' }}
      >
        {/* Outer decorative rings */}
        <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(57,255,20,0.25)" strokeWidth="1" />
        <circle
          cx="100"
          cy="100"
          r="91"
          fill="none"
          stroke="rgba(57,255,20,0.5)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />

        {/* Clockwise pie wipe — full at start, empty at end */}
        <motion.circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke="#39ff14"
          strokeWidth="6"
          strokeLinecap="butt"
          transform="rotate(-90 100 100)"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: circumference }}
          transition={{ duration: durS, ease: 'linear' }}
        />

        {/* Clock tick marks every 30 degrees */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = ((i * 30 - 90) * Math.PI) / 180
          const long = i % 3 === 0
          const inner = long ? 78 : 82
          const outer = long ? 89 : 87
          return (
            <line
              key={i}
              x1={100 + inner * Math.cos(angle)}
              y1={100 + inner * Math.sin(angle)}
              x2={100 + outer * Math.cos(angle)}
              y2={100 + outer * Math.sin(angle)}
              stroke="#39ff14"
              strokeWidth={long ? 2 : 1}
              opacity={long ? 0.85 : 0.45}
            />
          )
        })}

        {/* Crosshair marks at cardinal edges */}
        <g stroke="#39ff14" strokeWidth="1.5" opacity="0.75">
          <line x1="4" y1="100" x2="22" y2="100" />
          <line x1="178" y1="100" x2="196" y2="100" />
          <line x1="100" y1="4" x2="100" y2="22" />
          <line x1="100" y1="178" x2="100" y2="196" />
        </g>

        {/* Inner ring + center dot */}
        <circle cx="100" cy="100" r="4" fill="#39ff14" opacity="0.9" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(57,255,20,0.25)" strokeWidth="1" />

        {/* Big number — triple-rendered for chromatic aberration */}
        <g
          fontSize="108"
          fontFamily='"Press Start 2P", monospace'
          textAnchor="middle"
          dominantBaseline="central"
        >
          <text x="103" y="100" fill="rgba(255,0,110,0.75)">
            {value}
          </text>
          <text x="97" y="100" fill="rgba(0,240,255,0.75)">
            {value}
          </text>
          <text x="100" y="100" fill="#39ff14" stroke="#0a3d04" strokeWidth="1.5" style={{ paintOrder: 'stroke fill' }}>
            {value}
          </text>
        </g>
      </svg>

      {/* Sweeping scanline across the numeral */}
      <motion.div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        initial={{ opacity: 0.95 }}
        animate={{ opacity: [0.95, 0.2, 0] }}
        transition={{ duration: 0.45, times: [0, 0.4, 1] }}
      >
        <div
          className="absolute inset-x-0 h-3"
          style={{
            top: '50%',
            background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.85), transparent)',
            transform: 'translateY(-50%)',
            mixBlendMode: 'screen',
          }}
        />
      </motion.div>

      {/* Corner brackets — cine viewfinder style */}
      <div className="absolute inset-0 pointer-events-none">
        {(['tl', 'tr', 'bl', 'br'] as const).map((pos) => (
          <Bracket key={pos} pos={pos} />
        ))}
      </div>
    </motion.div>
  )
}

function Bracket({ pos }: { pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const style: React.CSSProperties = {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#39ff14',
    borderStyle: 'solid',
    opacity: 0.75,
    filter: 'drop-shadow(0 0 10px rgba(57,255,20,0.5))',
  }
  if (pos === 'tl') {
    style.top = 8
    style.left = 8
    style.borderWidth = '3px 0 0 3px'
  } else if (pos === 'tr') {
    style.top = 8
    style.right = 8
    style.borderWidth = '3px 3px 0 0'
  } else if (pos === 'bl') {
    style.bottom = 8
    style.left = 8
    style.borderWidth = '0 0 3px 3px'
  } else {
    style.bottom = 8
    style.right = 8
    style.borderWidth = '0 3px 3px 0'
  }
  return <div style={style} />
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
