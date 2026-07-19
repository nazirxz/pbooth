import { appConfig } from '@/config/app-config'

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
  finalExpiresAt: string | null
  liveExpiresAt: string | null
  assetsExpired: boolean
}

/**
 * Fetch short-lived download URLs through the public share Edge Function.
 * The R2 credential and signing implementation never enter the browser bundle.
 */
export async function fetchSharedSession(sessionId: string, shareToken: string): Promise<SharedSessionData> {
  if (!appConfig.supabase.url || !appConfig.supabase.anonKey) throw new Error('STORAGE_NOT_CONFIGURED')
  const response = await fetch(`${appConfig.supabase.url}/functions/v1/shared-session`, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.anonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ sessionId, shareToken }),
  })
  const data = await response.json().catch(() => ({})) as SharedSessionData & { error?: string }
  if (response.status === 410) throw new Error('ASSETS_EXPIRED')
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) throw new Error('SESSION_NOT_FOUND')
    throw new Error(data.error ?? 'SHARE_FETCH_FAILED')
  }
  return data
}
