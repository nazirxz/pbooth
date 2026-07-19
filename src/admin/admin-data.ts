import { useState, useCallback, useEffect } from 'react'
import { appConfig } from '@/config/app-config'
import { getSupabase } from '@/lib/supabase/client'
import type { AdminSessionRow, ListSessionsOpts, AdminPhotoRow } from '@/lib/supabase/sessions'
import type { AdminStats } from '@/lib/supabase/payments'

export type { AdminPhotoRow }

async function adminRequest<T>(body: Record<string, unknown>): Promise<T> {
  const sb = getSupabase()
  if (!sb || !appConfig.supabase.url || !appConfig.supabase.anonKey) {
    throw new Error('Supabase belum dikonfigurasi')
  }
  const { data, error } = await sb.auth.getSession()
  if (error || !data.session?.access_token) throw new Error('Sesi admin sudah berakhir')
  const response = await fetch(`${appConfig.supabase.url}/functions/v1/admin-sessions`, {
    method: 'POST',
    headers: {
      apikey: appConfig.supabase.anonKey,
      authorization: `Bearer ${data.session.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(result.error ?? `Admin request gagal (${response.status})`)
  return result
}

export async function checkAdminAuth(): Promise<boolean> {
  try {
    const result = await adminRequest<{ authorized: boolean }>({ action: 'me' })
    return result.authorized
  } catch {
    return false
  }
}

export async function loginAdmin(email: string, password: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('Supabase belum dikonfigurasi')
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error('Email atau password salah')
  if (!(await checkAdminAuth())) {
    await sb.auth.signOut()
    throw new Error('Akun ini tidak ada di allowlist admin')
  }
}

export async function logoutAdmin(): Promise<void> {
  await getSupabase()?.auth.signOut()
}

export function adminConfigured(): boolean {
  return !!appConfig.supabase.url && !!appConfig.supabase.anonKey
}

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await adminRequest<AdminStats>({ action: 'stats' }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void load() }, [load])
  return { stats, loading, error, reload: load }
}

export function useAdminSessions(opts: ListSessionsOpts) {
  const [rows, setRows] = useState<AdminSessionRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminRequest<{ rows: AdminSessionRow[]; total: number }>({ action: 'list', ...opts })
      setRows(data.rows)
      setTotal(data.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [opts.page, opts.pageSize, opts.status, opts.dateFrom, opts.dateTo])
  useEffect(() => { void load() }, [load])
  return { rows, total, loading, error, reload: load }
}

export async function getSessionRawPhotos(sessionId: string): Promise<AdminPhotoRow[]> {
  const result = await adminRequest<{ photos: AdminPhotoRow[] }>({ action: 'photos', sessionId })
  return result.photos
}

export async function deleteSession(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await adminRequest<{ success: boolean }>({ action: 'delete', sessionId: id })
    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function statusColor(status: AdminSessionRow['status']): string {
  switch (status) {
    case 'completed': return 'text-crt-phosphor border-crt-phosphor/50 bg-crt-phosphor/10'
    case 'paid': return 'text-vhs-cyan border-vhs-cyan/50 bg-vhs-cyan/10'
    case 'capturing': return 'text-crt-amber border-crt-amber/50 bg-crt-amber/10'
    case 'pending_payment': return 'text-vhs-yellow border-vhs-yellow/50 bg-vhs-yellow/10'
    case 'expired': return 'text-crt-red border-crt-red/50 bg-crt-red/10'
    case 'cancelled': return 'text-crt-cream/40 border-crt-cream/20 bg-crt-cream/5'
    default: return 'text-crt-cream/40 border-crt-cream/20 bg-crt-cream/5'
  }
}
