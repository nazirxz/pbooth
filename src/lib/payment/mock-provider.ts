import { appConfig } from '@/config/app-config'
import type { PaymentProvider, PaymentSession, PaymentStatus } from './types'

function uid() {
  return 'mock_' + Math.random().toString(36).slice(2, 10)
}

type Listener = (status: PaymentStatus) => void
const listeners = new Map<string, Listener>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const statuses = new Map<string, PaymentStatus>()

export const mockPaymentProvider: PaymentProvider = {
  name: 'mock',

  async createSession(amount, _opts) {
    const id = uid()
    const session: PaymentSession = {
      id,
      amount,
      currency: appConfig.payment.currency,
      qrString: `pbooth://mock-payment/${id}?amount=${amount}`,
      status: 'pending',
      expiresAt: new Date(Date.now() + appConfig.payment.timeoutSec * 1000),
    }
    statuses.set(id, 'pending')

    // Auto-resolve to paid after configured delay — for dev only.
    const t = setTimeout(() => {
      statuses.set(id, 'paid')
      listeners.get(id)?.('paid')
    }, appConfig.payment.mockAutoResolveMs)
    timers.set(id, t)

    return session
  },

  onStatusChange(sessionId, cb) {
    listeners.set(sessionId, cb)
    const cur = statuses.get(sessionId)
    if (cur && cur !== 'pending') queueMicrotask(() => cb(cur))
    return () => listeners.delete(sessionId)
  },

  async cancel(sessionId) {
    const t = timers.get(sessionId)
    if (t) clearTimeout(t)
    timers.delete(sessionId)
    statuses.set(sessionId, 'cancelled')
    listeners.get(sessionId)?.('cancelled')
  },
}

export function simulatePaid(sessionId: string) {
  const t = timers.get(sessionId)
  if (t) clearTimeout(t)
  statuses.set(sessionId, 'paid')
  listeners.get(sessionId)?.('paid')
}
