export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({
  limit:  z.string().optional().default('50').pipe(z.coerce.number().int().min(1).max(100)),
  offset: z.string().optional().default('0').pipe(z.coerce.number().int().min(0)),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error

  const parsed = Schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { limit, offset } = parsed.data
  const { customerId } = await params

  const customerRows = await sql`SELECT id FROM customers WHERE id = ${customerId} LIMIT 1`
  if (!customerRows[0]) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  const countRows = await sql`SELECT COUNT(*)::int as count FROM devices WHERE customer_id = ${customerId}`
  const total = countRows[0]?.count ?? 0

  const devices = await sql`
    SELECT d.id, d.customer_id, d.parent_device_id, d.name, d.device_type,
           d.connection_type, d.mac_address, d.created_at,
           ds.is_online::int AS is_online, ds.rssi_dbm,
           ds.upload_mbps, ds.download_mbps, ds.latency_ms,
           ds.recorded_at AS stats_recorded_at
    FROM devices d
    LEFT JOIN device_stats ds ON ds.device_id = d.id
    WHERE d.customer_id = ${customerId}
    ORDER BY d.created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `

  return NextResponse.json({
    data: devices,
    pagination: { total, limit, offset, hasMore: offset + limit < total },
  })
}
