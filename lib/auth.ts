import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sql } from '@/lib/db'

type AuthResult =
  | { user: User; error: null }
  | { user: null; error: NextResponse }

export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Authentication required', code: 'UNAUTHORIZED' }, { status: 401 }),
    }
  }
  return { user, error: null }
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth()
  if (result.error) return result

  const rows = await sql`SELECT role FROM user_profiles WHERE id = ${result.user.id} LIMIT 1`
  if (!rows[0] || rows[0].role !== 'admin') {
    return {
      user: null,
      error: NextResponse.json({ error: 'Admin access required', code: 'FORBIDDEN' }, { status: 403 }),
    }
  }
  return result
}
