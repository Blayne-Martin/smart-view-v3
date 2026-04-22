import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ customerId: string; deviceId: string }> }
) {
  const { error } = await requireAuth()
  if (error) return error

  const { customerId, deviceId } = await params

  const rows = await sql`
    SELECT d.id, d.customer_id, d.parent_device_id, d.name, d.device_type,
           d.connection_type, d.mac_address, d.created_at,
           ds.is_online::int AS is_online, ds.rssi_dbm,
           ds.upload_mbps, ds.download_mbps, ds.latency_ms,
           ds.recorded_at AS stats_recorded_at
    FROM devices d
    LEFT JOIN device_stats ds ON ds.device_id = d.id
    WHERE d.id = ${deviceId} AND d.customer_id = ${customerId}
    LIMIT 1
  `

  if (!rows[0]) {
    return NextResponse.json({ error: 'Device not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ data: rows[0] })
}
