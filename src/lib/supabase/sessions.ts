import { getSupabase } from './client'

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
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const { error } = await sb.from('sessions').update(patch).eq('id', id)
  if (error) console.warn('[supabase] updateSession failed:', error.message)
}
