import type { PaymentProvider } from './types'

// TODO(fase-2): integrate real payment (QRIS dinamis via Midtrans/Xendit/DOKU).
// Flow nanti:
//   1. createSession -> call backend/edge function -> return QR string + expiry
//   2. webhook payment gateway -> Supabase Edge Function -> update row `payments`
//   3. Realtime subscription push status 'paid' -> kiosk mulai capture
//
// Sementara stub: throw supaya salah konfigurasi ketahuan cepat.
export const qrisPaymentProvider: PaymentProvider = {
  name: 'qris',
  async createSession() {
    throw new Error('QRIS provider not yet implemented. Use mock provider for now.')
  },
  onStatusChange() {
    return () => {}
  },
  async cancel() {},
}
