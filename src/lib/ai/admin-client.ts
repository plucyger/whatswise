import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Lazy service-role client for the AI engine. Deliberately mirrors
// src/lib/automations/admin-client.ts and src/lib/flows/admin-client.ts
// rather than importing one of them: the three engines stay decoupled
// until their shapes stabilize (same call made in flows/meta-send.ts —
// extraction into a shared base is the eventual cleanup, tracked there).
let _adminClient: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
  }
  return _adminClient
}
