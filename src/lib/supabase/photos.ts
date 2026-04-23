import { getSupabase } from './client'
import { appConfig } from '@/config/app-config'

/**
 * Upload an individual frame to the `photos` bucket and record it in `photos` table.
 * Returns the storage path, or null if Supabase is not configured or upload failed.
 */
export async function uploadPhoto(
  sessionId: string,
  frameIndex: number,
  blob: Blob,
): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const path = `${sessionId}/frame_${frameIndex}.jpg`
  const { error: upErr } = await sb.storage
    .from(appConfig.supabase.photosBucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (upErr) {
    console.warn('[supabase] uploadPhoto failed:', upErr.message)
    return null
  }
  const { error: dbErr } = await sb.from('photos').insert({
    session_id: sessionId,
    frame_index: frameIndex,
    storage_path: path,
  })
  if (dbErr) console.warn('[supabase] photos insert failed:', dbErr.message)
  return path
}

/**
 * Upload the composed strip to the public `composed` bucket.
 * Returns the public URL on success, null otherwise.
 */
export async function uploadComposed(
  sessionId: string,
  blob: Blob,
): Promise<string | null> {
  const sb = getSupabase()
  if (!sb) return null
  const path = `${sessionId}/final.jpg`
  const { error } = await sb.storage
    .from(appConfig.supabase.composedBucket)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) {
    console.warn('[supabase] uploadComposed failed:', error.message)
    return null
  }
  const { data } = sb.storage.from(appConfig.supabase.composedBucket).getPublicUrl(path)
  return data.publicUrl
}
