import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const rows = await sql`
    SELECT
      COUNT(*)::int                                                 AS total,
      SUM(CASE WHEN health_score = 'Good' THEN 1 ELSE 0 END)::int AS healthy,
      SUM(CASE WHEN health_score = 'Warn' THEN 1 ELSE 0 END)::int AS warning,
      SUM(CASE WHEN health_score = 'Bad'  THEN 1 ELSE 0 END)::int AS critical
    FROM modem_stats
  `

  const summary = rows[0] ?? { total: 0, healthy: 0, warning: 0, critical: 0 }
  return NextResponse.json({ data: summary })
}
