import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error

  const { customerId } = await params
  const rows = await sql`
    SELECT id, name, email, created_at, updated_at
    FROM customers
    WHERE id = ${customerId}
    LIMIT 1
  `

  if (!rows[0]) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ data: rows[0] })
}
