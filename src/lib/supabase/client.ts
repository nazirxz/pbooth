import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { appConfig } from '@/config/app-config'

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!appConfig.supabase.url || !appConfig.supabase.anonKey) return null
  if (!client) {
    client = createClient(appConfig.supabase.url, appConfig.supabase.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return client
}

export function supabaseReady(): boolean {
  return getSupabase() !== null
}
