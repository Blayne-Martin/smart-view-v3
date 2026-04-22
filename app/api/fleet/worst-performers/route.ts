export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({
  limit:  z.string().optional().default('10').pipe(z.coerce.number().int().min(1).max(100)),
  status: z.enum(['Good', 'Warn', 'Bad']).optional(),
})

export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const parsed = Schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { limit, status } = parsed.data

  const statusFilter = status ? sql`AND ms.health_score = ${status}` : sql``

  const performers = await sql`
    SELECT
      ms.id, ms.customer_id, c.name,
      ms.latency, ms.jitter, ms.packet_loss, ms.snr,
      ms.health_score, ms.recorded_at
    FROM modem_stats ms
    LEFT JOIN customers c ON ms.customer_id = c.id
    WHERE 1=1 ${statusFilter}
    ORDER BY
      CASE ms.health_score WHEN 'Bad' THEN 1 WHEN 'Warn' THEN 2 WHEN 'Good' THEN 3 ELSE 4 END ASC,
      ms.latency DESC,
      ms.packet_loss DESC
    LIMIT ${limit}
  `

  return NextResponse.json({ data: performers })
}
