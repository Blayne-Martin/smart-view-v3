export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  const rows = await sql`
    SELECT
      COUNT(*)::int                                                                          AS total,
      SUM(CASE WHEN latency <= 20                      THEN 1 ELSE 0 END)::int             AS lat_0,
      SUM(CASE WHEN latency > 20  AND latency <= 50    THEN 1 ELSE 0 END)::int             AS lat_1,
      SUM(CASE WHEN latency > 50  AND latency <= 100   THEN 1 ELSE 0 END)::int             AS lat_2,
      SUM(CASE WHEN latency > 100 AND latency <= 200   THEN 1 ELSE 0 END)::int             AS lat_3,
      SUM(CASE WHEN latency > 200                      THEN 1 ELSE 0 END)::int             AS lat_4,
      SUM(CASE WHEN packet_loss <= 0.5                                   THEN 1 ELSE 0 END)::int AS pl_0,
      SUM(CASE WHEN packet_loss > 0.5  AND packet_loss <= 1              THEN 1 ELSE 0 END)::int AS pl_1,
      SUM(CASE WHEN packet_loss > 1    AND packet_loss <= 5              THEN 1 ELSE 0 END)::int AS pl_2,
      SUM(CASE WHEN packet_loss > 5    AND packet_loss <= 10             THEN 1 ELSE 0 END)::int AS pl_3,
      SUM(CASE WHEN packet_loss > 10                                     THEN 1 ELSE 0 END)::int AS pl_4,
      SUM(CASE WHEN jitter <= 5                        THEN 1 ELSE 0 END)::int             AS jit_0,
      SUM(CASE WHEN jitter > 5  AND jitter <= 10       THEN 1 ELSE 0 END)::int             AS jit_1,
      SUM(CASE WHEN jitter > 10 AND jitter <= 20       THEN 1 ELSE 0 END)::int             AS jit_2,
      SUM(CASE WHEN jitter > 20 AND jitter <= 50       THEN 1 ELSE 0 END)::int             AS jit_3,
      SUM(CASE WHEN jitter > 50                        THEN 1 ELSE 0 END)::int             AS jit_4,
      SUM(CASE WHEN snr > 35                           THEN 1 ELSE 0 END)::int             AS snr_0,
      SUM(CASE WHEN snr > 30 AND snr <= 35             THEN 1 ELSE 0 END)::int             AS snr_1,
      SUM(CASE WHEN snr > 25 AND snr <= 30             THEN 1 ELSE 0 END)::int             AS snr_2,
      SUM(CASE WHEN snr > 20 AND snr <= 25             THEN 1 ELSE 0 END)::int             AS snr_3,
      SUM(CASE WHEN snr <= 20                          THEN 1 ELSE 0 END)::int             AS snr_4
    FROM modem_stats
  `

  if (!rows[0]) return NextResponse.json({ error: 'No data', code: 'INTERNAL_ERROR' }, { status: 500 })
  const r = rows[0]
  const total = r.total || 1
  const pct = (n: number) => Math.round((n / total) * 100)

  return NextResponse.json({
    data: {
      total: r.total,
      latency:     [pct(r.lat_0), pct(r.lat_1), pct(r.lat_2), pct(r.lat_3), pct(r.lat_4)],
      packet_loss: [pct(r.pl_0),  pct(r.pl_1),  pct(r.pl_2),  pct(r.pl_3),  pct(r.pl_4)],
      jitter:      [pct(r.jit_0), pct(r.jit_1), pct(r.jit_2), pct(r.jit_3), pct(r.jit_4)],
      snr:         [pct(r.snr_0), pct(r.snr_1), pct(r.snr_2), pct(r.snr_3), pct(r.snr_4)],
    },
  })
}
