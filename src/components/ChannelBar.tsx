import { useTheme } from '@/state/theme-store'

interface Props {
  channel: string
  label: string
}

export function ChannelBar({ channel, label }: Props) {
  const themeId = useTheme((s) => s.themeId)

  if (themeId === 'y2k') {
    return (
      <div className="relative z-10 flex items-center justify-between px-10 py-4">
        <div className="flex items-center gap-3 font-bold tracking-widest text-purple-950/80" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          <span className="w-3 h-3 rounded-full bg-pink-500 animate-blink" />
          <span className="text-xl">LIVE · {channel}</span>
        </div>
        <div
          className="text-3xl font-extrabold tracking-[0.2em] text-transparent bg-clip-text"
          style={{
            fontFamily: 'Fredoka, Baloo 2, sans-serif',
            backgroundImage: 'linear-gradient(90deg, #ff4fa1, #b17cff, #00e5ff)',
          }}
        >
          {label}
        </div>
        <div className="text-xl font-semibold tracking-widest text-purple-950/60" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
          ✦ ONLINE
        </div>
      </div>
    )
  }

  return (
    <div className="relative z-10 flex items-center justify-between px-8 py-4 font-crt text-crt-cream text-3xl">
      <div className="flex items-center gap-4">
        <span className="w-3 h-3 rounded-full bg-crt-red animate-blink" />
        <span className="tracking-wider">CH {channel}</span>
      </div>
      <div className="tracking-[0.3em] text-crt-phosphor rgb-split">{label}</div>
      <div className="tracking-wider opacity-70">REC</div>
    </div>
  )
}
