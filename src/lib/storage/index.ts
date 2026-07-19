import { appConfig } from '@/config/app-config'
import * as supabasePhotos from '@/lib/supabase/photos'
import { uploadToR2 } from './r2-signed'

export async function uploadPhoto(
  sessionId: string,
  frameIndex: number,
  blob: Blob,
  shareToken: string,
): Promise<string | null> {
  const backend = appConfig.storage.backend

  if (backend === 'r2') {
    return uploadToR2({ sessionId, shareToken, kind: 'frame', frameIndex, blob })
  }

  // Default to Supabase
  return supabasePhotos.uploadPhoto(sessionId, frameIndex, blob)
}

export async function uploadComposed(
  sessionId: string,
  blob: Blob,
  shareToken: string,
): Promise<string | null> {
  const backend = appConfig.storage.backend

  if (backend === 'r2') {
    return uploadToR2({ sessionId, shareToken, kind: 'composed', blob })
  }

  // Default to Supabase
  return supabasePhotos.uploadComposed(sessionId, blob)
}

export async function uploadLiveAsset(
  sessionId: string,
  blob: Blob,
  ext: 'gif' | 'webm' | 'mp4',
  shareToken: string,
): Promise<string | null> {
  const backend = appConfig.storage.backend

  if (backend === 'r2') {
    return uploadToR2({ sessionId, shareToken, kind: 'live', ext, blob })
  }

  // Default to Supabase
  return supabasePhotos.uploadLiveAsset(sessionId, blob, ext)
}
