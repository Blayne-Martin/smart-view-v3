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
    SELECT id, customer_id, latency, jitter, packet_loss, snr, health_score, recorded_at
    FROM modem_stats
    WHERE customer_id = ${customerId}
    ORDER BY recorded_at DESC
    LIMIT 1
  `

  if (!rows[0]) {
    return NextResponse.json({ error: 'Modem stats not found', code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ data: rows[0] })
}
