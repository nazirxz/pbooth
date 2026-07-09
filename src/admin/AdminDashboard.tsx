import { useAdminStats, formatIDR } from './admin-data'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: 'green' | 'amber' | 'cyan' | 'cream'
  channel: string
}

function StatCard({ label, value, sub, accent = 'green', channel }: StatCardProps) {
  const accentClass = {
    green: 'text-crt-phosphor shadow-[0_0_20px_rgba(57,255,20,0.15)] border-crt-phosphor/25',
    amber: 'text-crt-amber shadow-[0_0_20px_rgba(255,179,0,0.15)] border-crt-amber/25',
    cyan:  'text-vhs-cyan shadow-[0_0_20px_rgba(0,240,255,0.15)] border-vhs-cyan/25',
    cream: 'text-crt-cream border-crt-cream/20',
  }[accent]

  return (
    <div className={`rounded-xl border bg-black/40 p-5 ${accentClass}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="font-crt text-crt-cream/40 text-xs tracking-widest">
          CH {channel}
        </span>
      </div>
      <div className="font-pixel text-2xl leading-tight mb-1 break-all">
        {value}
      </div>
      <div className="font-crt text-crt-cream/60 text-lg tracking-widest">{label}</div>
      {sub && (
        <div className="font-crt text-crt-cream/35 text-base mt-1 tracking-wider">{sub}</div>
      )}
    </div>
  )
}

export function AdminDashboard() {
  const { stats, loading, error, reload } = useAdminStats()

  return (
    <section id="admin-dashboard">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-crt-phosphor text-xs rgb-split">DASHBOARD</span>
          <span className="font-crt text-crt-cream/30 text-lg tracking-widest">— LIVE STATS</span>
        </div>
        <button
          id="admin-reload-stats"
          onClick={reload}
          disabled={loading}
          className="font-crt text-crt-cream/50 hover:text-crt-phosphor text-lg tracking-widest transition-colors disabled:opacity-40"
        >
          {loading ? '▌ LOADING...' : '↺ REFRESH'}
        </button>
      </div>

      {error && (
        <div className="font-crt text-crt-red text-lg mb-4 border border-crt-red/30 rounded-lg px-4 py-3 bg-crt-red/5">
          ✗ {error}
        </div>
      )}

      {loading && !stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-crt-cream/10 bg-black/40 p-5 h-32 animate-pulse" />
          ))}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            channel="01"
            label="TOTAL SESI"
            value={stats.totalSessions.toLocaleString()}
            sub={`${stats.paidSessions} selesai`}
            accent="green"
          />
          <StatCard
            channel="02"
            label="TOTAL REVENUE"
            value={formatIDR(stats.totalRevenue)}
            accent="amber"
          />
          <StatCard
            channel="03"
            label="SESI HARI INI"
            value={stats.todaySessions.toLocaleString()}
            accent="cyan"
          />
          <StatCard
            channel="04"
            label="REVENUE HARI INI"
            value={formatIDR(stats.todayRevenue)}
            accent="cream"
          />
        </div>
      )}
    </section>
  )
}
