import { useState } from 'react'
import { useAdminSessions, deleteSession, formatDateTime, statusColor } from './admin-data'
import type { AdminSessionRow, ListSessionsOpts } from '@/lib/supabase/sessions'

const PAGE_SIZE = 18

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'SEMUA STATUS' },
  { value: 'completed', label: 'COMPLETED' },
  { value: 'paid', label: 'PAID' },
  { value: 'capturing', label: 'CAPTURING' },
  { value: 'pending_payment', label: 'PENDING' },
  { value: 'expired', label: 'EXPIRED' },
  { value: 'cancelled', label: 'CANCELLED' },
]

interface Props {
  onSelectSession: (session: AdminSessionRow) => void
}

export function AdminGallery({ onSelectSession }: Props) {
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState<ListSessionsOpts['status']>('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const opts: ListSessionsOpts = {
    page,
    pageSize: PAGE_SIZE,
    status: status || undefined,
  }

  const { rows, total, loading, error, reload } = useAdminSessions(opts)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setConfirmId(null)
    const result = await deleteSession(id)
    setDeletingId(null)
    if (result.ok) {
      reload()
    } else {
      alert(`Gagal hapus sesi: ${result.error}`)
    }
  }

  return (
    <section id="admin-gallery">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="font-pixel text-crt-phosphor text-xs rgb-split">GALLERY</span>
        <div className="flex-1" />
        <select
          id="admin-status-filter"
          value={status ?? ''}
          onChange={(e) => {
            setStatus(e.target.value as ListSessionsOpts['status'])
            setPage(0)
          }}
          className="bg-black border border-crt-cream/30 text-crt-cream font-crt text-base tracking-widest rounded-lg px-3 py-1.5 outline-none focus:border-crt-phosphor/60 transition-colors"
          style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          id="admin-gallery-refresh"
          onClick={() => { setPage(0); reload() }}
          className="font-crt text-crt-cream/50 hover:text-crt-phosphor text-lg tracking-widest transition-colors"
        >
          ↺
        </button>
      </div>

      {/* Count */}
      <div className="font-crt text-crt-cream/40 text-base tracking-widest mb-4">
        {loading ? '▌ LOADING...' : `${total} SESI DITEMUKAN`}
      </div>

      {error && (
        <div className="font-crt text-crt-red text-lg mb-4 border border-crt-red/30 rounded-lg px-4 py-3 bg-crt-red/5">
          ✗ {error}
        </div>
      )}

      {/* Grid */}
      {!loading && rows.length === 0 && !error && (
        <div className="text-center py-20 font-crt text-crt-cream/30 text-xl tracking-widest">
          ◆ TIDAK ADA SESI ◆
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {rows.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            deleting={deletingId === session.id}
            confirming={confirmId === session.id}
            onView={() => onSelectSession(session)}
            onDeleteRequest={() => setConfirmId(session.id)}
            onDeleteConfirm={() => handleDelete(session.id)}
            onDeleteCancel={() => setConfirmId(null)}
          />
        ))}

        {/* Loading skeletons */}
        {loading && Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-crt-cream/10 bg-black/40 aspect-[3/4] animate-pulse"
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            id="admin-prev-page"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="font-pixel text-xs px-4 py-2 rounded-lg border border-crt-cream/30 text-crt-cream disabled:opacity-30 hover:border-crt-phosphor/50 hover:text-crt-phosphor transition-all"
          >
            ◀ PREV
          </button>
          <span className="font-crt text-crt-cream/50 text-lg tracking-widest">
            {page + 1} / {totalPages}
          </span>
          <button
            id="admin-next-page"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="font-pixel text-xs px-4 py-2 rounded-lg border border-crt-cream/30 text-crt-cream disabled:opacity-30 hover:border-crt-phosphor/50 hover:text-crt-phosphor transition-all"
          >
            NEXT ▶
          </button>
        </div>
      )}
    </section>
  )
}

// ─── Session Card ─────────────────────────────────────────────────────────

interface CardProps {
  session: AdminSessionRow
  deleting: boolean
  confirming: boolean
  onView: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

function SessionCard({ session, deleting, confirming, onView, onDeleteRequest, onDeleteConfirm, onDeleteCancel }: CardProps) {
  const statusCls = statusColor(session.status)
  const payment = session.payments?.[0]

  return (
    <div
      className="relative group rounded-xl border border-crt-cream/15 bg-black/60 overflow-hidden transition-all duration-200 hover:border-crt-phosphor/40 hover:shadow-[0_0_16px_rgba(57,255,20,0.1)]"
    >
      {/* Thumbnail / placeholder */}
      <button
        id={`admin-view-${session.id.slice(0, 8)}`}
        onClick={onView}
        className="block w-full aspect-[3/4] relative overflow-hidden bg-black/80"
      >
        {session.final_image_url ? (
          <img
            src={session.final_image_url}
            alt={`Session ${session.id.slice(0, 8)}`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="font-crt text-crt-cream/20 text-3xl">◻</div>
            <div className="font-crt text-crt-cream/20 text-xs tracking-widest">NO IMAGE</div>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="font-pixel text-white text-xs tracking-wider bg-black/60 px-3 py-1.5 rounded-lg">
            DETAIL
          </span>
        </div>
      </button>

      {/* Card footer */}
      <div className="p-2.5 space-y-1.5">
        {/* Status badge */}
        <div className={`inline-block font-crt text-xs border rounded px-2 py-0.5 tracking-wider leading-none ${statusCls}`}>
          {session.status.replace('_', ' ').toUpperCase()}
        </div>

        {/* Date */}
        <div className="font-crt text-crt-cream/40 text-xs leading-tight">
          {formatDateTime(session.created_at)}
        </div>

        {/* Payment */}
        {payment && (
          <div className="font-crt text-crt-cream/50 text-xs leading-tight">
            IDR {payment.amount?.toLocaleString('id-ID') ?? '—'}
          </div>
        )}

        {/* Delete controls */}
        <div className="pt-1">
          {deleting ? (
            <span className="font-crt text-crt-amber text-xs animate-blink">DELETING...</span>
          ) : confirming ? (
            <div className="flex gap-1.5">
              <button
                id={`admin-delete-confirm-${session.id.slice(0, 8)}`}
                onClick={onDeleteConfirm}
                className="flex-1 font-pixel text-[8px] py-1 rounded bg-crt-red/20 border border-crt-red/50 text-crt-red hover:bg-crt-red/30 transition-colors"
              >
                YA
              </button>
              <button
                id={`admin-delete-cancel-${session.id.slice(0, 8)}`}
                onClick={onDeleteCancel}
                className="flex-1 font-pixel text-[8px] py-1 rounded bg-crt-cream/5 border border-crt-cream/20 text-crt-cream/50 hover:bg-crt-cream/10 transition-colors"
              >
                BATAL
              </button>
            </div>
          ) : (
            <button
              id={`admin-delete-${session.id.slice(0, 8)}`}
              onClick={onDeleteRequest}
              className="font-crt text-crt-cream/25 hover:text-crt-red text-xs tracking-wider transition-colors"
            >
              ✕ hapus
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
