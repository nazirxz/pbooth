import { useEffect, useState } from 'react'
import type { AdminSessionRow } from '@/lib/supabase/sessions'
import { deleteSession, formatDateTime, formatIDR, statusColor, getSessionRawPhotos, type AdminPhotoRow } from './admin-data'

interface Props {
  session: AdminSessionRow
  onClose: () => void
  onDeleted: () => void
}

export function AdminSessionDetail({ session, onClose, onDeleted }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rawPhotos, setRawPhotos] = useState<AdminPhotoRow[] | null>(null)
  const [loadingRaw, setLoadingRaw] = useState(false)
  const payment = session.payments?.[0]

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Load raw photos
  useEffect(() => {
    let active = true
    async function loadRaw() {
      setLoadingRaw(true)
      try {
        const photos = await getSessionRawPhotos(session.id)
        if (active) setRawPhotos(photos)
      } catch (err) {
        console.error('Failed to load raw photos:', err)
      } finally {
        if (active) setLoadingRaw(false)
      }
    }
    loadRaw()
    return () => { active = false }
  }, [session.id])

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteSession(session.id)
    setDeleting(false)
    if (result.ok) {
      onDeleted()
    } else {
      alert(`Gagal hapus: ${result.error}`)
      setConfirmDelete(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 pt-12"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-2xl bg-crt-bg border border-crt-cream/20 rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 0 60px rgba(0,0,0,0.8), 0 0 1px rgba(57,255,20,0.2)' }}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-crt-cream/10">
          <div className="flex items-center gap-3">
            <span className="font-crt text-xs border border-crt-cream/30 px-2 py-0.5 rounded-sm text-crt-cream/40 tracking-widest">
              CH 05
            </span>
            <h2 className="font-pixel text-sm text-crt-phosphor rgb-split tracking-widest">
              SESSION DETAIL
            </h2>
          </div>
          <button
            id="admin-detail-close"
            onClick={onClose}
            className="font-crt text-2xl text-crt-cream/40 hover:text-crt-cream transition-colors leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Session ID + status */}
          <div className="flex flex-wrap items-center gap-3">
            <code className="font-mono text-crt-cream/60 text-sm bg-crt-cream/5 px-3 py-1 rounded-lg border border-crt-cream/10">
              {session.id}
            </code>
            <span className={`font-crt text-sm border rounded px-3 py-1 tracking-wider ${statusColor(session.status)}`}>
              {session.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Main content: image + info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Composed photo */}
            <div>
              <div className="font-crt text-xs text-crt-cream/40 tracking-widest mb-2">
                ◆ FOTO STRIP
              </div>
              {session.final_image_url ? (
                <a href={session.final_image_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={session.final_image_url}
                    alt="Session strip"
                    className="w-full rounded-xl border border-crt-cream/20 hover:border-crt-phosphor/40 transition-colors"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="aspect-[3/4] rounded-xl border border-dashed border-crt-cream/20 flex items-center justify-center">
                  <span className="font-crt text-crt-cream/25 tracking-widest">NO IMAGE</span>
                </div>
              )}
              {session.final_image_url && (
                <a
                  href={session.final_image_url}
                  download={`pbooth_${session.id.slice(0, 8)}_strip.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-center font-pixel text-[9px] tracking-widest py-2 rounded-lg border border-crt-phosphor/40 text-crt-phosphor hover:bg-crt-phosphor/10 transition-colors"
                >
                  ⬇ DOWNLOAD STRIP
                </a>
              )}
            </div>

            {/* Info panel */}
            <div className="space-y-4">
              {/* Timestamps */}
              <InfoBlock title="WAKTU">
                <InfoRow label="Dibuat" value={formatDateTime(session.created_at)} />
                {session.completed_at && (
                  <InfoRow label="Selesai" value={formatDateTime(session.completed_at)} />
                )}
              </InfoBlock>

              {/* Template / filter */}
              <InfoBlock title="KONFIGURASI">
                <InfoRow label="Template" value={session.template_id ?? '—'} />
                <InfoRow label="Filter" value={session.filter_id ?? '—'} />
              </InfoBlock>

              {/* Payment */}
              {payment && (
                <InfoBlock title="PEMBAYARAN">
                  <InfoRow label="Provider" value={payment.provider.toUpperCase()} />
                  <InfoRow label="Jumlah" value={formatIDR(payment.amount)} />
                  <InfoRow label="Status" value={payment.status.toUpperCase()} />
                  {payment.paid_at && (
                    <InfoRow label="Dibayar" value={formatDateTime(payment.paid_at)} />
                  )}
                </InfoBlock>
              )}

              {/* Live photo */}
              {session.live_video_url && (
                <InfoBlock title="LIVE PHOTO">
                  <div className="mt-1">
                    <img
                      src={session.live_video_url}
                      alt="Live photo"
                      className="w-full rounded-lg border border-crt-cream/20"
                      loading="lazy"
                    />
                    <a
                      href={session.live_video_url}
                      download={`pbooth_${session.id.slice(0, 8)}_live`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 block text-center font-pixel text-[9px] tracking-widest py-2 rounded-lg border border-crt-cream/30 text-crt-cream/60 hover:text-crt-cream hover:border-crt-cream/50 transition-colors"
                    >
                      ⬇ DOWNLOAD LIVE
                    </a>
                  </div>
                </InfoBlock>
              )}
            </div>
          </div>

          {/* Raw Photos section */}
          {((rawPhotos && rawPhotos.length > 0) || loadingRaw) && (
            <div className="border-t border-crt-cream/10 pt-5">
              <div className="font-crt text-xs text-crt-cream/40 tracking-widest mb-3">
                ◆ FOTO INDIVIDUAL (RAW FRAMES)
              </div>
              {loadingRaw ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] rounded-lg border border-crt-cream/10 bg-black/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {rawPhotos?.map((p) => (
                    <div
                      key={p.index}
                      className="relative group rounded-lg border border-crt-cream/15 overflow-hidden bg-black aspect-[4/3]"
                    >
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={p.url}
                          alt={`Frame ${p.index}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </a>
                      <div className="absolute bottom-1.5 left-1.5 bg-black/75 border border-crt-cream/10 px-1.5 py-0.5 rounded text-[8px] font-pixel text-crt-phosphor leading-none">
                        FRAME {p.index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delete section */}
          <div className="border-t border-crt-cream/10 pt-5">
            {!confirmDelete ? (
              <button
                id="admin-detail-delete"
                onClick={() => setConfirmDelete(true)}
                className="font-pixel text-xs tracking-widest px-5 py-2.5 rounded-lg border border-crt-red/40 text-crt-red bg-crt-red/5 hover:bg-crt-red/15 transition-all"
              >
                ✕ HAPUS SESI INI
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-crt text-crt-red text-lg tracking-widest">
                  Yakin hapus sesi ini dan semua fotonya?
                </span>
                <button
                  id="admin-detail-delete-confirm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="font-pixel text-xs tracking-widest px-5 py-2.5 rounded-lg bg-crt-red text-white hover:brightness-125 disabled:opacity-50 transition-all"
                >
                  {deleting ? 'MENGHAPUS...' : 'YA, HAPUS'}
                </button>
                <button
                  id="admin-detail-delete-cancel"
                  onClick={() => setConfirmDelete(false)}
                  className="font-pixel text-xs tracking-widest px-5 py-2.5 rounded-lg border border-crt-cream/30 text-crt-cream/60 hover:text-crt-cream transition-colors"
                >
                  BATAL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-black/40 rounded-xl border border-crt-cream/10 p-3">
      <div className="font-crt text-xs text-crt-cream/35 tracking-widest mb-2">◆ {title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center gap-2 text-sm">
      <span className="font-crt text-crt-cream/45 tracking-wider shrink-0">{label}</span>
      <span className="font-mono text-crt-cream/80 text-right break-all">{value}</span>
    </div>
  )
}
