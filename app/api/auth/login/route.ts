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
  try {
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
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError || !data.user) {
      console.error('Supabase auth error:', authError?.message)
      return NextResponse.json({ error: authError?.message ?? 'Invalid credentials', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check user_profiles — if DB isn't reachable yet, allow login with default role
    let role = 'user'
    let is_active = true
    try {
      const rows = await sql`SELECT role, is_active FROM user_profiles WHERE id = ${data.user.id} LIMIT 1`
      if (rows[0]) {
        role = rows[0].role
        is_active = rows[0].is_active
      }
    } catch (dbErr) {
      console.error('user_profiles lookup failed:', dbErr)
    }

    if (!is_active) {
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'Account deactivated', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    loginAttempts.delete(ip)

    return NextResponse.json({
      user: { id: data.user.id, email: data.user.email, role },
    })
  } catch (err) {
    console.error('Login route error:', err)
    return NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
