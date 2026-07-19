import { appConfig } from '@/config/app-config'
import { getSupabase } from '@/lib/supabase/client'
import { subscribePaymentStatus, dbUpdatePaymentStatus } from '@/lib/supabase/payments'
import type { PaymentProvider, PaymentSession, PaymentStatus } from './types'

/**
 * DOKU Checkout (sandbox/production) — Indonesia QRIS via the
 * `create-doku-payment` Supabase Edge Function.
 *
 * The kiosk never holds the DOKU Secret Key. The edge function
 *   1. signs the request with HMAC-SHA256
 *   2. calls `/checkout/v1/payment`
 *   3. inserts the `payments` row (status=pending) with the returned URL
 *
 * The kiosk then renders the URL as a QR (customer scans with their
 * phone, picks QRIS in the DOKU page) and subscribes to Supabase
 * Realtime for the row to flip to `paid` once `doku-webhook` fires.
 */

interface CreateResponse {
  paymentId: string
  amount: number
  invoiceNumber: string
  /** Raw QRIS EMV string — render directly as QR. Null if DOKU did not return one. */
  qrString: string | null
  /** DOKU hosted payment page URL — fallback when qrString is null. */
  paymentUrl: string | null
  nmid: string | null
  expiresAt: string
}

const DEFAULT_FUNCTION_PATH = '/functions/v1/create-doku-payment'

/** Resolve the full URL of the create-doku-payment edge function. */
function resolveCreateUrl(): string {
  const explicit = appConfig.payment.doku?.createUrl
  if (explicit) return explicit
  const base = appConfig.supabase.url.replace(/\/$/, '')
  if (!base) {
    throw new Error(
      '[doku] VITE_SUPABASE_URL not set — cannot resolve edge function URL',
    )
  }
  return `${base}${DEFAULT_FUNCTION_PATH}`
}

// Track active Realtime subscriptions per payment row id so cancel() can
// dispose them without piping callbacks back through the kiosk component.
const subs = new Map<string, () => void>()

export const qrisPaymentProvider: PaymentProvider = {
  name: 'doku',

  async createSession(amount, opts) {
    const url = resolveCreateUrl()
    const sb = getSupabase()
    if (!sb) {
      throw new Error('[doku] Supabase not configured (VITE_SUPABASE_* env)')
    }
    const anonKey = appConfig.supabase.anonKey
    if (!anonKey) {
      throw new Error('[doku] VITE_SUPABASE_ANON_KEY required to call edge function')
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Edge function `verify_jwt = true` -> requires anon key as Bearer.
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        amount,
        sessionId: opts?.sessionId ?? null,
        paymentDueMinutes: Math.ceil(appConfig.payment.timeoutSec / 60),
        // Don't restrict payment_method_types — that way DOKU's hosted page
        // (paymentUrl) lets the customer pick from any active method
        // (VA, e-wallet, CC, etc.). The edge function still pre-generates
        // the raw QRIS EMV string from the same checkout token, so the
        // kiosk can offer single-scan QRIS as the default while keeping
        // "OTHER METHODS" open as a fallback.
      }),
    })

    if (!res.ok) {
      const detail = await safeJson(res)
      throw new Error(
        `[doku] create payment failed: ${res.status} ${JSON.stringify(detail)}`,
      )
    }
    const data = (await res.json()) as CreateResponse

    // Prefer the raw QRIS string when DOKU returned one. Fall back to the
    // hosted-page URL — the kiosk will render that as a QR and the customer
    // opens it on their phone to complete payment via DOKU's picker.
    const qrString = data.qrString ?? data.paymentUrl
    if (!qrString) {
      throw new Error('[doku] DOKU did not return a QRIS string or payment URL')
    }

    return {
      id: data.paymentId,
      paymentRowId: data.paymentId,
      amount: data.amount,
      currency: appConfig.payment.currency,
      qrString,
      status: 'pending',
      expiresAt: new Date(data.expiresAt),
      paymentUrl: data.paymentUrl ?? undefined,
      nmid: data.nmid ?? undefined,
    } satisfies PaymentSession
  },

  onStatusChange(paymentRowId, cb) {
    // Reuse the existing Realtime helper that watches `payments.id=eq.<id>`.
    const dispose = subscribePaymentStatus(paymentRowId, (status) => {
      cb(status as PaymentStatus)
    })
    subs.set(paymentRowId, dispose)
    return () => {
      dispose()
      subs.delete(paymentRowId)
    }
  },

  async cancel(paymentRowId) {
    // DOKU itself doesn't expose a "cancel" endpoint for Checkout — the
    // hosted page expires by `payment_due_date`. We just record the
    // local intent so the kiosk UI doesn't keep waiting.
    subs.get(paymentRowId)?.()
    subs.delete(paymentRowId)
    await dbUpdatePaymentStatus(paymentRowId, 'cancelled')
  },
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return await res.text().catch(() => null)
  }
}

/**
 * Dev/demo helper: marks a `payments` row as paid directly via the anon
 * Supabase client. RLS policy `payments_update_anon` permits this, and
 * the Realtime subscription on the kiosk picks up the UPDATE event the
 * same way it would for a real DOKU webhook — so the kiosk auto-advances
 * to the next screen.
 *
 * Bypasses the `dev-simulate-paid` edge function entirely so it also
 * works when DOKU_ENV=production on Supabase (the edge function is
 * locked in that case for safety).
 */
export async function simulateDokuPaid(paymentRowId: string): Promise<void> {
  const sb = getSupabase()
  if (!sb) throw new Error('[doku] Supabase not configured')

  const nowIso = new Date().toISOString()
  const { data, error } = await sb
    .from('payments')
    .update({ status: 'paid', paid_at: nowIso })
    .eq('id', paymentRowId)
    .select('session_id')
    .single()
  if (error) {
    throw new Error(`[doku] simulate-paid failed: ${error.message}`)
  }
  if (data?.session_id) {
    await sb.from('sessions').update({ status: 'paid' }).eq('id', data.session_id)
  }
}
