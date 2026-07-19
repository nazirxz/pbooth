import { getSupabase } from './client'
import { appConfig } from '@/config/app-config'

export interface SessionRow {
  id: string
  status: 'pending_payment' | 'paid' | 'capturing' | 'completed' | 'expired' | 'cancelled'
  template_id: string | null
  filter_id: string | null
  payment_id: string | null
  final_image_url: string | null
  live_video_url: string | null
  final_storage_backend: 'supabase' | 'r2' | null
  final_storage_path: string | null
  live_storage_backend: 'supabase' | 'r2' | null
  live_storage_path: string | null
  final_expires_at: string | null
  live_expires_at: string | null
  assets_expired_at: string | null
  share_token_hash: string | null
  created_at: string
  completed_at: string | null
}

/**
 * Creates a session row. Returns null if Supabase is not configured —
 * callers should treat that as "offline mode" and continue the flow.
 */
export async function dbCreateSession(shareTokenHash: string): Promise<SessionRow | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('sessions')
    .insert({
      status: 'pending_payment',
      template_id: appConfig.templates[0].id,
      share_token_hash: shareTokenHash,
    })
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
  patch: Partial<Pick<SessionRow,
    | 'status' | 'template_id' | 'filter_id' | 'payment_id'
    | 'final_image_url' | 'live_video_url' | 'completed_at'
    | 'final_storage_backend' | 'final_storage_path' | 'live_storage_backend'
    | 'live_storage_path' | 'final_expires_at' | 'live_expires_at'
  >>,
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

export interface AdminPhotoRow {
  index: number
  url: string
}
