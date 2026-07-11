import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { appConfig } from '@/config/app-config'

/**
 * Admin Supabase client using the service-role key.
 * This bypasses RLS so the admin page can read all sessions / payments.
 *
 * The key is intentionally loaded from a Vite env var — the /admin route
 * is not publicly linked and is protected by a password gate in the UI.
 * Never ship this key in a public-facing kiosk build.
 */
let adminClient: SupabaseClient | null = null

export function getAdminSupabase(): SupabaseClient | null {
  const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!appConfig.supabase.url || !serviceRoleKey) return null
  if (!adminClient) {
    adminClient = createClient(appConfig.supabase.url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return adminClient
}

export function adminSupabaseReady(): boolean {
  return getAdminSupabase() !== null
}
