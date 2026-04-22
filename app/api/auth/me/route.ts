export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const { user, error } = await requireAuth()
  if (error) return error

  const rows = await sql`SELECT role, is_active FROM user_profiles WHERE id = ${user.id} LIMIT 1`
  const profile = rows[0]

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      role: profile?.role ?? 'user',
      is_active: profile?.is_active ?? true,
      created_at: user.created_at,
    },
  })
}
