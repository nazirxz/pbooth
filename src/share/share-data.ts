import { getSupabase } from '@/lib/supabase/client'
import { appConfig } from '@/config/app-config'
import { getR2SignedUrl } from '@/lib/r2/photos'

export interface SharedPhoto {
  index: number
  url: string
}

export interface SharedSessionData {
  sessionId: string
  composedUrl: string | null
  liveVideoUrl: string | null
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
    .select('id, final_image_url, live_video_url, created_at')
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
  // Sign raw-frame URLs with the configured backend. (The old heuristic
  // `!path.includes('supabase')` was always true for Supabase paths like
  // `<session>/frame_0.jpg`, so every raw photo got routed to R2 signing and
  // silently dropped — the section disappeared on the web.)
  const isR2 = appConfig.storage.backend === 'r2'
  for (const p of photos ?? []) {
    if (isR2) {
      // R2 storage - use R2 presigned URL
      const signedUrl = await getR2SignedUrl(p.storage_path, SIGNED_URL_TTL)
      if (signedUrl) {
        photoEntries.push({ index: p.frame_index, url: signedUrl })
      }
    } else {
      // Supabase storage - use Supabase signed URL
      const { data: signed, error: signErr } = await sb.storage
        .from(appConfig.supabase.photosBucket)
        .createSignedUrl(p.storage_path, SIGNED_URL_TTL)
      if (signErr || !signed) continue
      photoEntries.push({ index: p.frame_index, url: signed.signedUrl })
    }
  }

  return {
    sessionId: session.id,
    composedUrl: await resolvePublicUrl(session.final_image_url),
    liveVideoUrl: await resolvePublicUrl(session.live_video_url),
    photos: photoEntries,
    createdAt: session.created_at ?? null,
  }
}

/**
 * Resolve public URLs for composed/live assets. If the URL is already a full URL
 * (Supabase public URL or R2 public URL), return as-is. If it's an R2 path without
 * public URL configured, generate a presigned URL.
 */
async function resolvePublicUrl(url: string | null): Promise<string | null> {
  if (!url) return null

  // Already a full URL (starts with http/https)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // R2 path without public URL - generate presigned URL
  const signedUrl = await getR2SignedUrl(url, SIGNED_URL_TTL)
  return signedUrl
}
