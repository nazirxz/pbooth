import { appConfig } from '@/config/app-config'
import { mockPaymentProvider } from './mock-provider'
import { qrisPaymentProvider } from './qris-provider'
import type { PaymentProvider } from './types'

export function getPaymentProvider(): PaymentProvider {
  switch (appConfig.payment.provider) {
    case 'mock':
      return mockPaymentProvider
    case 'qris':
    case 'midtrans':
      return qrisPaymentProvider
    default:
      return mockPaymentProvider
  }
}

export * from './types'
export { simulatePaid } from './mock-provider'
