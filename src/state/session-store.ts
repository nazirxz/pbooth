import { create } from 'zustand'
import type { FilterId, TemplateId } from '@/config/app-config'
import type { PaymentSession } from '@/lib/payment'

export type ScreenId =
  | 'boot'
  | 'home'
  | 'payment'
  | 'template'
  | 'filter'
  | 'capture'
  | 'preview'

export interface CapturedPhoto {
  index: number
  blob: Blob
  dataUrl: string
}

interface SessionState {
  screen: ScreenId
  sessionId: string | null
  payment: PaymentSession | null
  template: TemplateId
  filter: FilterId
  photos: CapturedPhoto[]
  composedUrl: string | null

  goTo: (screen: ScreenId) => void
  setSessionId: (id: string | null) => void
  setPayment: (p: PaymentSession | null) => void
  setTemplate: (t: TemplateId) => void
  setFilter: (f: FilterId) => void
  addPhoto: (photo: CapturedPhoto) => void
  clearPhotos: () => void
  setComposed: (url: string | null) => void
  reset: () => void
}

const initial = {
  screen: 'boot' as ScreenId,
  sessionId: null,
  payment: null,
  template: 'strip-4' as TemplateId,
  filter: 'none' as FilterId,
  photos: [] as CapturedPhoto[],
  composedUrl: null,
}

export const useSession = create<SessionState>((set) => ({
  ...initial,
  goTo: (screen) => set({ screen }),
  setSessionId: (sessionId) => set({ sessionId }),
  setPayment: (payment) => set({ payment }),
  setTemplate: (template) => set({ template }),
  setFilter: (filter) => set({ filter }),
  addPhoto: (photo) => set((s) => ({ photos: [...s.photos, photo] })),
  clearPhotos: () => set({ photos: [] }),
  setComposed: (composedUrl) => set({ composedUrl }),
  reset: () => set({ ...initial, screen: 'home' }),
}))
