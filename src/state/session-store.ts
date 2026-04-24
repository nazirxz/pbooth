import { create } from 'zustand'
import type { FilterId, TemplateId } from '@/config/app-config'
import type { PaymentSession } from '@/lib/payment'

export type ScreenId =
  | 'boot'
  | 'theme-select'
  | 'home'
  | 'payment'
  | 'template'
  | 'filter'
  | 'capture'
  | 'decorate'
  | 'preview'

export interface CapturedPhoto {
  index: number
  blob: Blob
  dataUrl: string
}

export interface ComposedOutput {
  blob: Blob
  dataUrl: string
  publicUrl: string | null // null when Supabase upload didn't happen (offline / no env)
}

interface SessionState {
  screen: ScreenId
  sessionId: string | null
  paymentRowId: string | null
  payment: PaymentSession | null
  template: TemplateId
  filter: FilterId
  photos: CapturedPhoto[]
  composed: ComposedOutput | null

  goTo: (screen: ScreenId) => void
  setSessionId: (id: string | null) => void
  setPaymentRowId: (id: string | null) => void
  setPayment: (p: PaymentSession | null) => void
  setTemplate: (t: TemplateId) => void
  setFilter: (f: FilterId) => void
  addPhoto: (photo: CapturedPhoto) => void
  clearPhotos: () => void
  setComposed: (c: ComposedOutput | null) => void
  reset: () => void
}

const initial = {
  screen: 'boot' as ScreenId,
  sessionId: null,
  paymentRowId: null,
  payment: null,
  template: 'strip-4' as TemplateId,
  filter: 'none' as FilterId,
  photos: [] as CapturedPhoto[],
  composed: null as ComposedOutput | null,
}

export const useSession = create<SessionState>((set) => ({
  ...initial,
  goTo: (screen) => set({ screen }),
  setSessionId: (sessionId) => set({ sessionId }),
  setPaymentRowId: (paymentRowId) => set({ paymentRowId }),
  setPayment: (payment) => set({ payment }),
  setTemplate: (template) => set({ template }),
  setFilter: (filter) => set({ filter }),
  addPhoto: (photo) => set((s) => ({ photos: [...s.photos, photo] })),
  clearPhotos: () => set({ photos: [] }),
  setComposed: (composed) => set({ composed }),
  reset: () => set({ ...initial, screen: 'theme-select' }),
}))
