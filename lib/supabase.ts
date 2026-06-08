// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Prefer client-visible NEXT_PUBLIC vars, but fall back to server-only envs
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error(
    'Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (for client) or SUPABASE_URL and SUPABASE_ANON_KEY (for server) in your environment or .env.local.'
  )
}

export const supabase = createClient(url, key)

// ── Auth helpers ──────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getUser() {
  const { data } = await supabase.auth.getUser()
  return data.user
}
