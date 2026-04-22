import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getAdminSupabase } from '@/lib/supabase/admin'
import { sql } from '@/lib/db'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { password, is_active, role } = body

  if (password !== undefined) {
    const { error: pwErr } = await getAdminSupabase().auth.admin.updateUserById(id, { password })
    if (pwErr) return NextResponse.json({ error: 'Failed to update password', code: 'INTERNAL_ERROR' }, { status: 500 })
  }

  const profileUpdates: Record<string, unknown> = {}
  if (is_active !== undefined) profileUpdates.is_active = Boolean(is_active)
  if (role !== undefined) {
    if (!['admin', 'user'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or user', code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    profileUpdates.role = role
  }

  if (Object.keys(profileUpdates).length > 0) {
    await sql`
      UPDATE user_profiles
      SET ${sql(profileUpdates)}
      WHERE id = ${id}
    `
  }

  const rows = await sql`SELECT role, is_active FROM user_profiles WHERE id = ${id} LIMIT 1`
  const { data: { user } } = await getAdminSupabase().auth.admin.getUserById(id)

  return NextResponse.json({
    data: {
      id,
      email: user?.email,
      role: rows[0]?.role ?? 'user',
      is_active: rows[0]?.is_active ?? true,
      created_at: user?.created_at,
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  // Prevent deleting the last admin
  const rows = await sql`SELECT role FROM user_profiles WHERE id = ${id} LIMIT 1`
  if (rows[0]?.role === 'admin') {
    const adminCount = await sql`SELECT COUNT(*)::int as count FROM user_profiles WHERE role = 'admin'`
    if ((adminCount[0]?.count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last admin account', code: 'CONFLICT' }, { status: 409 })
    }
  }

  const { error: delErr } = await getAdminSupabase().auth.admin.deleteUser(id)
  if (delErr) return NextResponse.json({ error: 'Failed to delete user', code: 'INTERNAL_ERROR' }, { status: 500 })

  return NextResponse.json({ message: 'User deleted' })
}
