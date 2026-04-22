import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({
  days:  z.string().optional().default('7').pipe(z.coerce.number().int()).refine((v) => [1, 7, 30, 90].includes(v), { message: 'days must be 1, 7, 30, or 90' }),
  limit: z.string().optional().default('200').pipe(z.coerce.number().int().min(1).max(200)),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string; deviceId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error

  const parsed = Schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { days, limit } = parsed.data
  const { customerId, deviceId } = await params

  const deviceRows = await sql`SELECT id FROM devices WHERE id = ${deviceId} AND customer_id = ${customerId} LIMIT 1`
  if (!deviceRows[0]) {
    return NextResponse.json({ error: 'Device not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const countRows = await sql`
    SELECT COUNT(*)::int as count FROM device_history
    WHERE device_id = ${deviceId} AND recorded_at >= ${startDate}
  `
  const total = countRows[0]?.count ?? 0

  const allRecords = await sql`
    SELECT id, device_id, is_online::int AS is_online, rssi_dbm,
           upload_mbps, download_mbps, latency_ms, recorded_at
    FROM device_history
    WHERE device_id = ${deviceId} AND recorded_at >= ${startDate}
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
