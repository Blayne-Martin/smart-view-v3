export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { z } from 'zod'

const CustomerParamsSchema = z.object({
  limit:  z.string().optional().default('50').pipe(z.coerce.number().int().min(1).max(100)),
  offset: z.string().optional().default('0').pipe(z.coerce.number().int().min(0)),
  search: z.string().optional(),
  status: z.enum(['Good', 'Warn', 'Bad']).optional(),
})

export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const parsed = CustomerParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: parsed.error.errors }, { status: 400 })
  }
  const { limit, offset, search, status } = parsed.data

  const searchFilter = search
    ? sql`AND (c.name ILIKE ${'%' + search + '%'} OR c.email ILIKE ${'%' + search + '%'})`
    : sql``
  const statusFilter = status ? sql`AND ms.health_score = ${status}` : sql``

  const countRows = await sql`
    SELECT COUNT(*)::int as count
    FROM customers c
    LEFT JOIN modem_stats ms ON ms.customer_id = c.id
    WHERE 1=1 ${searchFilter} ${statusFilter}
  `
  const total = countRows[0]?.count ?? 0

  const customers = await sql`
    SELECT c.id, c.name, c.email, c.created_at, c.updated_at, ms.health_score
    FROM customers c
    LEFT JOIN modem_stats ms ON ms.customer_id = c.id
    WHERE 1=1 ${searchFilter} ${statusFilter}
    ORDER BY c.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return NextResponse.json({
    data: customers,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  })
}
