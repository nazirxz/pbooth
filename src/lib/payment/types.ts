export type PaymentStatus = 'idle' | 'pending' | 'paid' | 'expired' | 'failed' | 'cancelled'

export interface PaymentSession {
  id: string
  amount: number
  currency: string
  qrString: string
  status: PaymentStatus
  expiresAt: Date
}

export interface PaymentProvider {
  readonly name: string
  createSession(amount: number): Promise<PaymentSession>
  onStatusChange(sessionId: string, cb: (status: PaymentStatus) => void): () => void
  cancel(sessionId: string): Promise<void>
}
