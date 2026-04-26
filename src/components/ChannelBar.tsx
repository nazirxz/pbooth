import { useSession } from '@/state/session-store'

interface Props {
  channel: string
  label: string
}

export function ChannelBar({ channel, label }: Props) {
  const paidAt = useSession((s) => s.paidAt)

  return (
    <div className="relative z-10 flex items-center justify-between px-8 py-4 font-crt text-crt-cream text-3xl">
      <div className="flex items-center gap-4">
        <span className="w-3 h-3 rounded-full bg-crt-red animate-blink" />
        <span className="tracking-wider">CH {channel}</span>
      </div>
      <div className="tracking-[0.3em] text-crt-phosphor rgb-split">{label}</div>
      {/* When paid, the SessionTimer overlays this corner — hide REC to avoid clash. */}
      {paidAt ? (
        <div className="w-32" aria-hidden="true" />
      ) : (
        <div className="tracking-wider opacity-70">REC</div>
      )}
    </div>
  )
}
