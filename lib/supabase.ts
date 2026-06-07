import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side (browser)
export const supabase = createClient(url, anon)

// Server-side (API routes, server components)
export function createServiceClient() {
  return createClient(url, service)
}
