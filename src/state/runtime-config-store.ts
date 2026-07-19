import { create } from 'zustand'
import { appConfig } from '@/config/app-config'
import { getSupabase } from '@/lib/supabase/client'

const PRICE_CACHE_KEY = 'pbooth.sessionPrice'

function cachedPrice(): number {
  if (typeof localStorage === 'undefined') return appConfig.payment.amount
  const value = Number(localStorage.getItem(PRICE_CACHE_KEY))
  return Number.isInteger(value) && value > 0 ? value : appConfig.payment.amount
}

interface RuntimeConfigState {
  sessionPrice: number
  loaded: boolean
  setSessionPrice: (price: number) => void
  setLoaded: () => void
}

export const useRuntimeConfig = create<RuntimeConfigState>((set) => ({
  sessionPrice: cachedPrice(),
  loaded: false,
  setSessionPrice: (sessionPrice) => {
    if (!Number.isInteger(sessionPrice) || sessionPrice <= 0) return
    localStorage.setItem(PRICE_CACHE_KEY, String(sessionPrice))
    set({ sessionPrice })
  },
  setLoaded: () => set({ loaded: true }),
}))

export function startRuntimeConfigSync(): () => void {
  const sb = getSupabase()
  if (!sb) {
    console.warn('[runtime-config] Supabase unavailable; using cached/default session price')
    useRuntimeConfig.getState().setLoaded()
    return () => undefined
  }

  let active = true
  void sb.from('app_settings')
    .select('session_price')
    .eq('key', 'global')
    .single()
    .then(({ data, error }) => {
      if (!active) return
      if (error) console.warn('[runtime-config] price fetch failed; using cached/default value', error.message)
      if (data?.session_price) useRuntimeConfig.getState().setSessionPrice(data.session_price)
      useRuntimeConfig.getState().setLoaded()
    })

  const channel = sb.channel('pbooth-runtime-config')
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'key=eq.global' },
      (payload) => {
        const price = Number((payload.new as { session_price?: unknown }).session_price)
        useRuntimeConfig.getState().setSessionPrice(price)
      },
    )
    .subscribe()

  return () => {
    active = false
    void sb.removeChannel(channel)
  }
}
