export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { sql } from '@/lib/db'

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const { data: { users }, error: listErr } = await getAdminSupabase().auth.admin.listUsers({ perPage: 1000 })
  if (listErr) return NextResponse.json({ error: 'Failed to list users', code: 'INTERNAL_ERROR' }, { status: 500 })

  const ids = users.map((u) => u.id)
  const profiles = ids.length > 0
    ? await sql`SELECT id, role, is_active FROM user_profiles WHERE id = ANY(${sql.array(ids)}::uuid[])`
    : []

  const profileMap = new Map(profiles.map((p: any) => [p.id, p]))
  const result = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: (profileMap.get(u.id) as any)?.role ?? 'user',
    is_active: (profileMap.get(u.id) as any)?.is_active ?? true,
    created_at: u.created_at,
  }))

  return NextResponse.json({ data: result })
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json().catch(() => ({}))
  const { email, password, role = 'user' } = body

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  if (!['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'Role must be admin or user', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  const { data: { user }, error: createErr } = await getAdminSupabase().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !user) {
    const msg = createErr?.message?.includes('already') ? 'Email already in use' : 'Failed to create user'
    const code = createErr?.message?.includes('already') ? 'CONFLICT' : 'INTERNAL_ERROR'
    return NextResponse.json({ error: msg, code }, { status: createErr?.message?.includes('already') ? 409 : 500 })
  }

  await sql`INSERT INTO user_profiles (id, role) VALUES (${user.id}, ${role}) ON CONFLICT (id) DO NOTHING`

  return NextResponse.json({
    data: { id: user.id, email: user.email, role, is_active: true, created_at: user.created_at },
  }, { status: 201 })
}
