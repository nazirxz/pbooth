import { getSupabase } from './client'
import { getAdminSupabase } from './admin-client'
import { appConfig } from '@/config/app-config'
import { getR2SignedUrl } from '@/lib/r2/photos'

export interface SessionRow {
  id: string
  status: 'pending_payment' | 'paid' | 'capturing' | 'completed' | 'expired' | 'cancelled'
  template_id: string | null
  filter_id: string | null
  payment_id: string | null
  final_image_url: string | null
  live_video_url: string | null
  created_at: string
  completed_at: string | null
}

/**
 * Creates a session row. Returns null if Supabase is not configured —
 * callers should treat that as "offline mode" and continue the flow.
 */
export async function dbCreateSession(): Promise<SessionRow | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('sessions')
    .insert({ status: 'pending_payment' })
    .select('*')
    .single()
  if (error) {
    console.warn('[supabase] createSession failed:', error.message)
    return null
  }
  return data as SessionRow
}

export async function dbUpdateSession(
  id: string,
  patch: Partial<Pick<SessionRow, 'status' | 'template_id' | 'filter_id' | 'payment_id' | 'final_image_url' | 'live_video_url' | 'completed_at'>>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabase()
  if (!sb) return { ok: false, error: 'supabase not configured' }
  const { error } = await sb.from('sessions').update(patch).eq('id', id)
  if (error) {
    console.warn('[supabase] updateSession failed:', error.message, 'patch:', patch)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

// ─── Admin ────────────────────────────────────────────────────────────────

export interface AdminSessionRow extends SessionRow {
  payments?: {
    id: string
    amount: number
    status: string
    provider: string
    paid_at: string | null
    created_at: string
  }[]
}

export interface ListSessionsOpts {
  page?: number        // 0-indexed
  pageSize?: number
  status?: SessionRow['status'] | ''
  dateFrom?: string    // ISO date string
  dateTo?: string
}

export async function dbListSessions(
  opts: ListSessionsOpts = {},
): Promise<{ rows: AdminSessionRow[]; total: number; error?: string } | null> {
  const sb = getAdminSupabase()
  if (!sb) return null

  const { page = 0, pageSize = 20, status, dateFrom, dateTo } = opts
  const from = page * pageSize
  const to = from + pageSize - 1

  let q = sb
    .from('sessions')
    .select('*, payments!session_id(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) q = q.eq('status', status)
  if (dateFrom) q = q.gte('created_at', dateFrom)
  if (dateTo) q = q.lte('created_at', dateTo)

  const { data, error, count } = await q
  if (error) {
    console.warn('[admin] listSessions failed:', error.message)
    return { rows: [], total: 0, error: error.message }
  }
  return { rows: (data ?? []) as AdminSessionRow[], total: count ?? 0 }
}

export async function dbDeleteSession(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getAdminSupabase()
  if (!sb) return { ok: false, error: 'admin client not configured' }

  // Remove storage objects for this session
  try {
    const { data: photoFiles } = await sb.storage
      .from(appConfig.supabase.photosBucket)
      .list(id)
    if (photoFiles && photoFiles.length > 0) {
      await sb.storage
        .from(appConfig.supabase.photosBucket)
        .remove(photoFiles.map((f) => `${id}/${f.name}`))
    }
  } catch (_) { /* non-critical */ }

  try {
    const { data: composedFiles } = await sb.storage
      .from(appConfig.supabase.composedBucket)
      .list(id)
    if (composedFiles && composedFiles.length > 0) {
      await sb.storage
        .from(appConfig.supabase.composedBucket)
        .remove(composedFiles.map((f) => `${id}/${f.name}`))
    }
  } catch (_) { /* non-critical */ }

  const { error } = await sb.from('sessions').delete().eq('id', id)
  if (error) {
    console.warn('[admin] deleteSession failed:', error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export interface AdminPhotoRow {
  index: number
  url: string
}

export async function dbGetSessionRawPhotos(
  sessionId: string,
): Promise<AdminPhotoRow[] | null> {
  const sb = getAdminSupabase()
  if (!sb) return null

  const { data: photos, error } = await sb
    .from('photos')
    .select('frame_index, storage_path')
    .eq('session_id', sessionId)
    .order('frame_index')

  if (error) {
    console.warn('[admin] dbGetSessionRawPhotos failed:', error.message)
    return null
  }

  const SIGNED_URL_TTL = 60 * 60 * 24 * 7 // 7 days
  const isR2 = appConfig.storage.backend === 'r2'
  const photoEntries: AdminPhotoRow[] = []

  for (const p of photos ?? []) {
    if (isR2) {
      const signedUrl = await getR2SignedUrl(p.storage_path, SIGNED_URL_TTL)
      if (signedUrl) {
        photoEntries.push({ index: p.frame_index, url: signedUrl })
      }
    } else {
      const { data: signed, error: signErr } = await sb.storage
        .from(appConfig.supabase.photosBucket)
        .createSignedUrl(p.storage_path, SIGNED_URL_TTL)
      if (signErr || !signed) continue
      photoEntries.push({ index: p.frame_index, url: signed.signedUrl })
    }
  }

  return photoEntries
}
