import { appConfig } from '@/config/app-config'
import * as supabasePhotos from '@/lib/supabase/photos'
import * as r2Photos from '@/lib/r2/photos'
import { getSupabase } from '@/lib/supabase/client'

export async function uploadPhoto(
  sessionId: string,
  frameIndex: number,
  blob: Blob,
): Promise<string | null> {
  const backend = appConfig.storage.backend

  if (backend === 'r2') {
    const path = await r2Photos.uploadPhotoToR2(sessionId, frameIndex, blob)
    if (!path) return null

    // Insert metadata into Supabase database
    const sb = getSupabase()
    if (sb) {
      const { error } = await sb.from('photos').insert({
        session_id: sessionId,
        frame_index: frameIndex,
        storage_path: path,
      })
      if (error) {
        console.warn('[storage] photos table insert failed:', error.message)
      }
    }

    return path
  }

  // Default to Supabase
  return supabasePhotos.uploadPhoto(sessionId, frameIndex, blob)
}

export async function uploadComposed(
  sessionId: string,
  blob: Blob,
): Promise<string | null> {
  const backend = appConfig.storage.backend

  if (backend === 'r2') {
    return r2Photos.uploadComposedToR2(sessionId, blob)
  }

  // Default to Supabase
  return supabasePhotos.uploadComposed(sessionId, blob)
}

export async function uploadLiveAsset(
  sessionId: string,
  blob: Blob,
  ext: string,
): Promise<string | null> {
  const backend = appConfig.storage.backend

  if (backend === 'r2') {
    return r2Photos.uploadLiveAssetToR2(sessionId, blob, ext)
  }

  // Default to Supabase
  return supabasePhotos.uploadLiveAsset(sessionId, blob, ext)
}

export async function getSignedUrl(
  path: string,
  expiresIn?: number,
): Promise<string | null> {
  // Detect backend from path/URL pattern
  if (path.includes('supabase.co') || path.includes('supabase')) {
    // Supabase URL - use Supabase signed URL
    const sb = getSupabase()
    if (!sb) return null

    const { data, error } = await sb.storage
      .from(appConfig.supabase.photosBucket)
      .createSignedUrl(path, expiresIn ?? 604800)

    if (error) {
      console.error('[storage] supabase signed URL failed:', error.message)
      return null
    }

    return data.signedUrl
  }

  // R2 path - use R2 presigned URL
  return r2Photos.getR2SignedUrl(path, expiresIn)
}
