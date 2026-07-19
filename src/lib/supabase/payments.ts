import { getSupabase } from './client'
import type { PaymentStatus } from '@/lib/payment'

export interface PaymentRow {
  id: string
  session_id: string | null
  provider: string
  provider_ref: string | null
  amount: number
  status: PaymentStatus
  qr_string: string | null
  paid_at: string | null
  expires_at: string | null
  created_at: string
}

export async function dbCreatePayment(opts: {
  sessionId: string | null
  provider: string
  providerRef?: string
  amount: number
  qrString: string
  expiresAt: Date
}): Promise<PaymentRow | null> {
  const sb = getSupabase()
  if (!sb) return null
  const { data, error } = await sb
    .from('payments')
    .insert({
      session_id: opts.sessionId,
      provider: opts.provider,
      provider_ref: opts.providerRef ?? null,
      amount: opts.amount,
      status: 'pending',
      qr_string: opts.qrString,
      expires_at: opts.expiresAt.toISOString(),
    })
    .select('*')
    .single()
  if (error) {
    console.warn('[supabase] createPayment failed:', error.message)
    return null
  }
  return data as PaymentRow
}

export async function dbUpdatePaymentStatus(id: string, status: PaymentStatus): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const patch: Record<string, unknown> = { status }
  if (status === 'paid') patch.paid_at = new Date().toISOString()
  const { error } = await sb.from('payments').update(patch).eq('id', id)
  if (error) console.warn('[supabase] updatePaymentStatus failed:', error.message)
}

/**
 * Subscribe to payment status changes via Supabase Realtime.
 * Returns an unsubscribe function. No-op when Supabase is not configured.
 */
export function subscribePaymentStatus(
  paymentId: string,
  cb: (status: PaymentStatus) => void,
): () => void {
  const sb = getSupabase()
  if (!sb) return () => {}
  const channel = sb
    .channel(`payment:${paymentId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'payments', filter: `id=eq.${paymentId}` },
      (payload) => {
        const status = (payload.new as PaymentRow).status
        cb(status)
      },
    )
    .subscribe()
  return () => {
    sb.removeChannel(channel)
  }
}

// ─── Admin ────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalSessions: number
  paidSessions: number
  totalRevenue: number
  todaySessions: number
  todayRevenue: number
}
