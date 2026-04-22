import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sql } from '@/lib/db'

const loginAttempts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
    return true
  }
  if (entry.count >= 5) return false
  entry.count += 1
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many login attempts', code: 'RATE_LIMITED' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({}))
  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    return NextResponse.json({ error: 'Invalid credentials', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  // Check is_active
  const rows = await sql`SELECT role, is_active FROM user_profiles WHERE id = ${data.user.id} LIMIT 1`
  const profile = rows[0]
  if (profile && !profile.is_active) {
    await supabase.auth.signOut()
    return NextResponse.json({ error: 'Account deactivated', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  loginAttempts.delete(ip)

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email,
      role: profile?.role ?? 'user',
    },
  })
}
