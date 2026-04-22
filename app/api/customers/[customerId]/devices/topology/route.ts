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

  const customerRows = await sql`SELECT id FROM customers WHERE id = ${customerId} LIMIT 1`
  if (!customerRows[0]) {
    return NextResponse.json({ error: 'Customer not found', code: 'NOT_FOUND' }, { status: 404 })
  }

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
  `

  return NextResponse.json({ data: devices })
}
