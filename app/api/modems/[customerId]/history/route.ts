export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { z } from 'zod'

const HistoryParamsSchema = z.object({
  days:  z.string().optional().default('7').pipe(z.coerce.number().int()).refine((v) => [1, 7, 30, 90].includes(v), { message: 'days must be 1, 7, 30, or 90' }),
  limit: z.string().optional().default('200').pipe(z.coerce.number().int().min(1).max(200)),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error

  const parsed = HistoryParamsSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { days, limit } = parsed.data
  const { customerId } = await params

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const countRows = await sql`
    SELECT COUNT(*)::int as count FROM modem_history
    WHERE customer_id = ${customerId} AND recorded_at >= ${startDate}
  `
  const total = countRows[0]?.count ?? 0

  const allRecords = await sql`
    SELECT id, customer_id, latency, jitter, packet_loss, snr, health_score, recorded_at
    FROM modem_history
    WHERE customer_id = ${customerId} AND recorded_at >= ${startDate}
    ORDER BY recorded_at ASC
  `

  let samplingApplied = false
  let data: typeof allRecords | typeof allRecords[number][] = allRecords

  if (allRecords.length > limit) {
    samplingApplied = true
    const step = Math.ceil(allRecords.length / limit)
    data = allRecords.filter((_: unknown, i: number) => i % step === 0).slice(0, limit)
  }

  return NextResponse.json({
    data,
    pagination: { total, limit, offset: 0, hasMore: false },
    samplingApplied,
  })
}
