import { useState } from 'react'
import { AdminLogin } from './AdminLogin'
import { AdminDashboard } from './AdminDashboard'
import { AdminGallery } from './AdminGallery'
import { AdminSessionDetail } from './AdminSessionDetail'
import { checkAdminAuth, logoutAdmin, adminConfigured } from './admin-data'
import type { AdminSessionRow } from '@/lib/supabase/sessions'

type View = 'dashboard' | 'gallery'

export function AdminPage() {
  const [authed, setAuthed] = useState(() => checkAdminAuth())
  const [view, setView] = useState<View>('gallery')
  const [selectedSession, setSelectedSession] = useState<AdminSessionRow | null>(null)
  const [galleryKey, setGalleryKey] = useState(0) // used to force remount gallery after delete

  if (!adminConfigured()) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-4 p-8">
        {/* Scanlines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.05) 3px, rgba(255,255,255,0.05) 4px)',
          }}
        />
        <div className="relative z-10 text-center space-y-4">
          <div className="font-pixel text-crt-red text-xs rgb-split tracking-widest">ERROR</div>
          <h1 className="font-pixel text-white text-sm tracking-widest">ADMIN NOT CONFIGURED</h1>
          <div className="font-crt text-crt-cream/50 text-lg max-w-sm leading-snug">
            Tambahkan <code className="text-crt-amber">VITE_ADMIN_PASSWORD</code> dan{' '}
            <code className="text-crt-amber">VITE_SUPABASE_SERVICE_ROLE_KEY</code>{' '}
            ke file .env kamu.
          </div>
        </div>
      </div>
    )
  }

  if (!authed) {
    return <AdminLogin onSuccess={() => setAuthed(true)} />
  }

  return (
    <div className="min-h-screen bg-crt-bg text-crt-cream overflow-y-auto">
      {/* Subtle scanlines bg */}
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        style={{
          background: 'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.04) 3px, rgba(255,255,255,0.04) 4px)',
        }}
      />

      {/* Top nav */}
      <header className="relative z-10 sticky top-0 border-b border-crt-cream/10 bg-crt-bg/90 backdrop-blur-sm px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-pixel text-crt-phosphor text-xs rgb-split">PBOOTH</span>
            <span className="font-crt text-crt-cream/30 text-lg tracking-widest">ADMIN</span>
          </div>

          {/* Nav tabs */}
          <nav className="flex items-center gap-1">
            {(['gallery', 'dashboard'] as const).map((v) => (
              <button
                key={v}
                id={`admin-nav-${v}`}
                onClick={() => setView(v)}
                className={[
                  'font-pixel text-[10px] tracking-widest px-4 py-2 rounded-lg transition-all',
                  view === v
                    ? 'bg-crt-phosphor/15 text-crt-phosphor border border-crt-phosphor/40'
                    : 'text-crt-cream/40 hover:text-crt-cream/70 border border-transparent',
                ].join(' ')}
              >
                {v.toUpperCase()}
              </button>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Logout */}
          <button
            id="admin-logout"
            onClick={() => { logoutAdmin(); setAuthed(false) }}
            className="font-crt text-crt-cream/35 hover:text-crt-red text-lg tracking-widest transition-colors"
          >
            ✕ LOGOUT
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-10">
        {view === 'dashboard' && <AdminDashboard />}

        {view === 'gallery' && (
          <AdminGallery
            key={galleryKey}
            onSelectSession={(s) => setSelectedSession(s)}
          />
        )}
      </main>

      {/* Session detail modal */}
      {selectedSession && (
        <AdminSessionDetail
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onDeleted={() => {
            setSelectedSession(null)
            setGalleryKey((k) => k + 1)
          }}
        />
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-crt-cream/10 py-4 text-center">
        <p className="font-crt text-crt-cream/20 text-base tracking-widest">
          ◆ PBOOTH ADMIN PANEL · {new Date().getFullYear()} ◆
        </p>
      </footer>
    </div>
  )
}
