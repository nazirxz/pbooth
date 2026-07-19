import { appConfig } from '@/config/app-config'
import { getSupabase } from '@/lib/supabase/client'

type AssetKind = 'frame' | 'composed' | 'live'

interface UploadInput {
  sessionId: string
  shareToken: string
  kind: AssetKind
  blob: Blob
  frameIndex?: number
  ext?: 'gif' | 'webm' | 'mp4'
}

interface SignedUpload {
  key: string
  uploadUrl: string
  headers: Record<string, string>
}

const MAX_PARALLEL_UPLOADS = 2
const MAX_RETRIES = 3
let activeUploads = 0
const waiters: Array<() => void> = []

async function acquireUploadSlot(): Promise<() => void> {
  if (activeUploads >= MAX_PARALLEL_UPLOADS) {
    await new Promise<void>((resolve) => waiters.push(resolve))
  }
  activeUploads += 1
  return () => {
    activeUploads -= 1
    waiters.shift()?.()
  }
}

function contentTypeFor(input: UploadInput): string {
  if (input.kind !== 'live') return 'image/jpeg'
  if (input.ext === 'gif') return 'image/gif'
  if (input.ext === 'mp4') return 'video/mp4'
  return 'video/webm'
}

async function callStorageFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase()
  if (!sb || !appConfig.supabase.url || !appConfig.supabase.anonKey) {
    throw new Error('Supabase storage functions are not configured')
  }
  const { data: sessionData } = await sb.auth.getSession()
  const bearer = sessionData.session?.access_token ?? appConfig.supabase.anonKey
  const response = await fetch(`${appConfig.supabase.url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.anonKey,
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as Record<string, unknown>
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : `${name} failed (${response.status})`)
  }
  return result as T
}

function retryDelay(attempt: number): Promise<void> {
  const base = 500 * 2 ** attempt
  const jitter = Math.floor(Math.random() * 250)
  return new Promise((resolve) => setTimeout(resolve, base + jitter))
}

export async function uploadToR2(input: UploadInput): Promise<string> {
  if (!input.shareToken) throw new Error('Share token is missing')
  if (input.blob.size <= 0 || input.blob.size > 50 * 1024 * 1024) {
    throw new Error('Asset must be between 1 byte and 50 MiB')
  }
  const release = await acquireUploadSlot()
  const request = {
    sessionId: input.sessionId,
    shareToken: input.shareToken,
    kind: input.kind,
    frameIndex: input.frameIndex,
    ext: input.ext,
    contentType: contentTypeFor(input),
    sizeBytes: input.blob.size,
  }

  try {
    let lastError: unknown
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        // A fresh URL is deliberately requested on every retry.
        const signed = await callStorageFunction<SignedUpload>('r2-sign-upload', request)
        const uploaded = await fetch(signed.uploadUrl, {
          method: 'PUT',
          headers: signed.headers,
          body: input.blob,
        })
        if (!uploaded.ok) throw new Error(`R2 PUT failed (${uploaded.status})`)
        const completed = await callStorageFunction<{ key: string }>('r2-complete-upload', request)
        return completed.key
      } catch (error) {
        lastError = error
        if (attempt < MAX_RETRIES) await retryDelay(attempt)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('R2 upload failed')
  } finally {
    release()
  }
}
