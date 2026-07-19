export interface ShareCredentials {
  token: string
  hash: string
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function createShareCredentials(): Promise<ShareCredentials> {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = toBase64Url(bytes)
  return { token, hash: await hashShareToken(token) }
}
