export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sql } from '@/lib/db'
import { z } from 'zod'

const Schema = z.object({
  days: z.string().optional().default('30').pipe(z.coerce.number().int()).refine((v) => [7, 30, 90].includes(v), { message: 'days must be 7, 30, or 90' }),
})

export async function GET(request: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const parsed = Schema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation error', code: 'VALIDATION_ERROR' }, { status: 400 })
  }
  const { days } = parsed.data
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const daily = await sql`
    SELECT
      (recorded_at AT TIME ZONE 'UTC')::date::text                                                     AS date,
      ROUND(AVG(latency)::numeric,     2)                                                              AS avg_latency,
      ROUND(MIN(latency)::numeric,     2)                                                              AS min_latency,
      ROUND(MAX(latency)::numeric,     2)                                                              AS max_latency,
      ROUND(AVG(packet_loss)::numeric, 2)                                                              AS avg_packet_loss,
      ROUND(MIN(packet_loss)::numeric, 2)                                                              AS min_packet_loss,
      ROUND(MAX(packet_loss)::numeric, 2)                                                              AS max_packet_loss,
      ROUND(AVG(jitter)::numeric,      2)                                                              AS avg_jitter,
      ROUND(MIN(jitter)::numeric,      2)                                                              AS min_jitter,
      ROUND(MAX(jitter)::numeric,      2)                                                              AS max_jitter,
      ROUND(AVG(snr)::numeric,         2)                                                              AS avg_snr,
      ROUND(MIN(snr)::numeric,         2)                                                              AS min_snr,
      ROUND(MAX(snr)::numeric,         2)                                                              AS max_snr,
      ROUND((SUM(CASE WHEN health_score='Good' THEN 1 ELSE 0 END)::decimal * 100 / COUNT(*))::numeric, 1) AS pct_good,
      ROUND((SUM(CASE WHEN health_score='Warn' THEN 1 ELSE 0 END)::decimal * 100 / COUNT(*))::numeric, 1) AS pct_warn,
      ROUND((SUM(CASE WHEN health_score='Bad'  THEN 1 ELSE 0 END)::decimal * 100 / COUNT(*))::numeric, 1) AS pct_bad,
      COUNT(*)::int                                                                                    AS sample_count
    FROM modem_history
    WHERE recorded_at >= ${startDate}
    GROUP BY (recorded_at AT TIME ZONE 'UTC')::date
    ORDER BY date ASC
  `

  const dist = await sql`
    SELECT
      COUNT(*)::int                                                                           AS total,
      SUM(CASE WHEN latency <= 20                      THEN 1 ELSE 0 END)::int              AS lat_0,
      SUM(CASE WHEN latency > 20  AND latency <= 50    THEN 1 ELSE 0 END)::int              AS lat_1,
      SUM(CASE WHEN latency > 50  AND latency <= 100   THEN 1 ELSE 0 END)::int              AS lat_2,
      SUM(CASE WHEN latency > 100 AND latency <= 200   THEN 1 ELSE 0 END)::int              AS lat_3,
      SUM(CASE WHEN latency > 200                      THEN 1 ELSE 0 END)::int              AS lat_4,
      SUM(CASE WHEN packet_loss <= 0.5                 THEN 1 ELSE 0 END)::int              AS pl_0,
      SUM(CASE WHEN packet_loss > 0.5  AND packet_loss <= 1  THEN 1 ELSE 0 END)::int        AS pl_1,
      SUM(CASE WHEN packet_loss > 1    AND packet_loss <= 5  THEN 1 ELSE 0 END)::int        AS pl_2,
      SUM(CASE WHEN packet_loss > 5    AND packet_loss <= 10 THEN 1 ELSE 0 END)::int        AS pl_3,
      SUM(CASE WHEN packet_loss > 10                         THEN 1 ELSE 0 END)::int        AS pl_4,
      SUM(CASE WHEN jitter <= 5                        THEN 1 ELSE 0 END)::int              AS jit_0,
      SUM(CASE WHEN jitter > 5  AND jitter <= 10       THEN 1 ELSE 0 END)::int              AS jit_1,
      SUM(CASE WHEN jitter > 10 AND jitter <= 20       THEN 1 ELSE 0 END)::int              AS jit_2,
      SUM(CASE WHEN jitter > 20 AND jitter <= 50       THEN 1 ELSE 0 END)::int              AS jit_3,
      SUM(CASE WHEN jitter > 50                        THEN 1 ELSE 0 END)::int              AS jit_4,
      SUM(CASE WHEN snr > 35                           THEN 1 ELSE 0 END)::int              AS snr_0,
      SUM(CASE WHEN snr > 30 AND snr <= 35             THEN 1 ELSE 0 END)::int              AS snr_1,
      SUM(CASE WHEN snr > 25 AND snr <= 30             THEN 1 ELSE 0 END)::int              AS snr_2,
      SUM(CASE WHEN snr > 20 AND snr <= 25             THEN 1 ELSE 0 END)::int              AS snr_3,
      SUM(CASE WHEN snr <= 20                          THEN 1 ELSE 0 END)::int              AS snr_4
    FROM modem_history
    WHERE recorded_at >= ${startDate}
  `

  const d = dist[0] ?? {}
  const total = (d.total as number) || 1
  const pct = (n: number) => Math.round((n / total) * 100)

  const summary = daily.length > 0 ? {
    avg_latency:     Math.round(daily.reduce((s: number, r: any) => s + Number(r.avg_latency),     0) / daily.length * 10) / 10,
    avg_packet_loss: Math.round(daily.reduce((s: number, r: any) => s + Number(r.avg_packet_loss), 0) / daily.length * 10) / 10,
    avg_jitter:      Math.round(daily.reduce((s: number, r: any) => s + Number(r.avg_jitter),      0) / daily.length * 10) / 10,
    avg_snr:         Math.round(daily.reduce((s: number, r: any) => s + Number(r.avg_snr),         0) / daily.length * 10) / 10,
  } : { avg_latency: 0, avg_packet_loss: 0, avg_jitter: 0, avg_snr: 0 }

  return NextResponse.json({
    data: {
      days,
      summary,
      daily,
      distribution: {
        total: d.total ?? 0,
        latency:     [pct(d.lat_0), pct(d.lat_1), pct(d.lat_2), pct(d.lat_3), pct(d.lat_4)],
        packet_loss: [pct(d.pl_0),  pct(d.pl_1),  pct(d.pl_2),  pct(d.pl_3),  pct(d.pl_4)],
        jitter:      [pct(d.jit_0), pct(d.jit_1), pct(d.jit_2), pct(d.jit_3), pct(d.jit_4)],
        snr:         [pct(d.snr_0), pct(d.snr_1), pct(d.snr_2), pct(d.snr_3), pct(d.snr_4)],
      },
    },
  })
}
