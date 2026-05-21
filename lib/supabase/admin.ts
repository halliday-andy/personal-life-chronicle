import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client for background agents.
 *
 * Distinct from `lib/supabase/server.ts`'s `createServiceClient()`, which is
 * cookies-bound and only works inside Next.js route handlers. Agents run from
 * Inngest functions and from synchronous tool calls — neither has an HTTP
 * cookie context. This client uses the service role key directly and bypasses
 * RLS. NEVER expose to the client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase URL or service role key missing from env')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
