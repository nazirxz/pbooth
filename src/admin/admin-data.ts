import { useState, useCallback, useEffect } from 'react'
import {
  dbListSessions,
  type AdminSessionRow,
  type ListSessionsOpts,
  dbDeleteSession,
} from '@/lib/supabase/sessions'
import { dbGetAdminStats, type AdminStats } from '@/lib/supabase/payments'
import { adminSupabaseReady } from '@/lib/supabase/admin-client'

// ─── Auth ─────────────────────────────────────────────────────────────────

const ADMIN_PWD = import.meta.env.VITE_ADMIN_PASSWORD ?? ''
const SESSION_KEY = 'pbooth_admin_auth'

export function checkAdminAuth(): boolean {
  if (!ADMIN_PWD) return false
  return sessionStorage.getItem(SESSION_KEY) === ADMIN_PWD
}

export function loginAdmin(password: string): boolean {
  if (!ADMIN_PWD || password !== ADMIN_PWD) return false
  sessionStorage.setItem(SESSION_KEY, password)
  return true
}

export function logoutAdmin() {
  sessionStorage.removeItem(SESSION_KEY)
}

export function adminConfigured(): boolean {
  return !!ADMIN_PWD && adminSupabaseReady()
}

// ─── Stats hook ───────────────────────────────────────────────────────────

export function useAdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await dbGetAdminStats()
      if (!data) throw new Error('Admin Supabase client not configured')
      setStats(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return { stats, loading, error, reload: load }
}

// ─── Sessions hook ────────────────────────────────────────────────────────

export function useAdminSessions(opts: ListSessionsOpts) {
  const [rows, setRows] = useState<AdminSessionRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await dbListSessions(opts)
      if (!data) throw new Error('Admin Supabase client not configured')
      setRows(data.rows)
      setTotal(data.total)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(opts)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  return { rows, total, loading, error, reload: load }
}

// ─── Delete helper ────────────────────────────────────────────────────────

export async function deleteSession(id: string): Promise<{ ok: boolean; error?: string }> {
  return dbDeleteSession(id)
}

// ─── Formatters ───────────────────────────────────────────────────────────

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function statusColor(status: AdminSessionRow['status']): string {
  switch (status) {
    case 'completed':      return 'text-crt-phosphor border-crt-phosphor/50 bg-crt-phosphor/10'
    case 'paid':           return 'text-vhs-cyan border-vhs-cyan/50 bg-vhs-cyan/10'
    case 'capturing':      return 'text-crt-amber border-crt-amber/50 bg-crt-amber/10'
    case 'pending_payment': return 'text-vhs-yellow border-vhs-yellow/50 bg-vhs-yellow/10'
    case 'expired':        return 'text-crt-red border-crt-red/50 bg-crt-red/10'
    case 'cancelled':      return 'text-crt-cream/40 border-crt-cream/20 bg-crt-cream/5'
    default:               return 'text-crt-cream/40 border-crt-cream/20 bg-crt-cream/5'
  }
}
