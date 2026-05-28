export type PaymentStatus = 'idle' | 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled'

export interface PaymentSession {
  id: string
  amount: number
  currency: string
  qrString: string
  status: PaymentStatus
  expiresAt: Date
  /**
   * When set, the provider has already created the matching `payments` row
   * in Supabase and this is its primary key. PaymentScreen should skip
   * `dbCreatePayment` and subscribe to status changes for this row id.
   *
   * Used by the DOKU provider where the edge function owns row creation;
   * the mock provider leaves this undefined and the kiosk inserts the row.
   */
  paymentRowId?: string
  /**
   * Hosted-page URL where the customer can pick from any DOKU-supported
   * method (VA, e-wallet, credit card, etc.) when they don't want to use
   * the primary `qrString`. Optional — only set by providers that have one.
   */
  paymentUrl?: string
  /** Acquirer NMID for QRIS payments — useful to display next to the QR. */
  nmid?: string
}

export interface PaymentProvider {
  readonly name: string
  createSession(amount: number, opts?: { sessionId?: string | null }): Promise<PaymentSession>
  onStatusChange(sessionId: string, cb: (status: PaymentStatus) => void): () => void
  cancel(sessionId: string): Promise<void>
}
