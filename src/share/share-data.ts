import { getSupabase } from '@/lib/supabase/client'
import { appConfig } from '@/config/app-config'

export interface SharedPhoto {
  index: number
  url: string
}

export interface SharedSessionData {
  sessionId: string
  composedUrl: string | null
  photos: SharedPhoto[]
  createdAt: string | null
}

const SIGNED_URL_TTL = 60 * 60 * 24 * 7 // 7 days

/**
 * Fetch all deliverables for a finished session. Raw frame URLs are signed
 * (private bucket) — composed strip lives in the public bucket so it gets a
 * stable URL. Throws when Supabase isn't configured or the session is missing.
 */
export async function fetchSharedSession(sessionId: string): Promise<SharedSessionData> {
  const sb = getSupabase()
  if (!sb) throw new Error('STORAGE_NOT_CONFIGURED')

  const { data: session, error: sessErr } = await sb
    .from('sessions')
    .select('id, final_image_url, created_at')
    .eq('id', sessionId)
    .single()
  if (sessErr || !session) throw new Error('SESSION_NOT_FOUND')

  const { data: photos, error: photoErr } = await sb
    .from('photos')
    .select('frame_index, storage_path')
    .eq('session_id', sessionId)
    .order('frame_index')
  if (photoErr) throw new Error('PHOTOS_FETCH_FAILED')

  const photoEntries: SharedPhoto[] = []
  for (const p of photos ?? []) {
    const { data: signed, error: signErr } = await sb.storage
      .from(appConfig.supabase.photosBucket)
      .createSignedUrl(p.storage_path, SIGNED_URL_TTL)
    if (signErr || !signed) continue
    photoEntries.push({ index: p.frame_index, url: signed.signedUrl })
  }

  return {
    sessionId: session.id,
    composedUrl: session.final_image_url ?? null,
    photos: photoEntries,
    createdAt: session.created_at ?? null,
  }
}
