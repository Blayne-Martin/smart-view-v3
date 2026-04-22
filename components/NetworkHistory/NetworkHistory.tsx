'use client'

import React, { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'
import { useNetworkHistory } from '@/hooks/useFleetDashboard'

type Days = 7 | 30 | 90

const DIST_COLORS = ['#22c55e', '#86efac', '#facc15', '#f97316', '#ef4444']

const DIST_LABELS = {
  latency:     ['≤20ms', '21-50ms', '51-100ms', '101-200ms', '>200ms'],
  packet_loss: ['≤0.5%', '0.5-1%', '1-5%', '5-10%', '>10%'],
  jitter:      ['≤5ms', '5-10ms', '11-20ms', '21-50ms', '>50ms'],
  snr:         ['>35dB', '30-35dB', '25-30dB', '20-25dB', '≤20dB'],
}

function fmtDate(dateStr: string, days: Days) {
  const d = new Date(dateStr)
  if (days === 7) return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

const SummaryKpi: React.FC<{ label: string; value: string; sub: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    <p className="text-xs text-gray-400 mt-1">{sub}</p>
  </div>
)

const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({ title, subtitle, children, className = '' }) => (
  <div className={`bg-white border border-gray-200 rounded-2xl p-6 ${className}`}>
    <div className="mb-4">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
)

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0,1,2,3].map(i => <div key={i} className="bg-white border border-gray-200 rounded-2xl h-28" />)}
    </div>
    <div className="bg-white border border-gray-200 rounded-2xl h-64" />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {[0,1,2,3].map(i => <div key={i} className="bg-white border border-gray-200 rounded-2xl h-56" />)}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[0,1,2,3].map(i => <div key={i} className="bg-white border border-gray-200 rounded-2xl h-52" />)}
    </div>
  </div>
)

const MetricTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color || p.fill }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  )
}

const HealthTrendChart: React.FC<{ data: any[]; days: Days }> = ({ data, days }) => {
  const chartData = data.map(d => ({
    date: fmtDate(d.date, days),
    Healthy: d.pct_good,
    Warning: d.pct_warn,
    Critical: d.pct_bad,
  }))

  return (
    <SectionCard title="Health Status Trend" subtitle="Daily % of fleet by health classification">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="gGood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="gWarn" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#facc15" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#facc15" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id="gBad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.85} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip content={<MetricTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="Healthy" stackId="1" stroke="#16a34a" fill="url(#gGood)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="Warning" stackId="1" stroke="#ca8a04" fill="url(#gWarn)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="Critical" stackId="1" stroke="#dc2626" fill="url(#gBad)" strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

interface MetricTrendProps {
  data: any[]
  days: Days
  avgKey: string
  minKey: string
  maxKey: string
  title: string
  unit: string
  color: string
  refLines?: { value: number; label: string; color: string }[]
}

const MetricTrendChart: React.FC<MetricTrendProps> = ({ data, days, avgKey, minKey, maxKey, title, unit, color, refLines }) => {
  const chartData = data.map(d => ({
    date: fmtDate(d.date, days),
    avg: d[avgKey],
    min: d[minKey],
    max: d[maxKey],
  }))

  return (
    <SectionCard title={title} subtitle={`Daily average with min/max range · ${unit}`}>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id={`band-${avgKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.15} />
              <stop offset="95%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <Tooltip content={<MetricTooltip />} />
          {refLines?.map((r, i) => (
            <ReferenceLine key={i} y={r.value} stroke={r.color} strokeDasharray="4 4" label={{ value: r.label, fill: r.color, fontSize: 10 }} />
          ))}
          <Area type="monotone" dataKey="max" stroke="none" fill={color} fillOpacity={0.12} legendType="none" />
          <Area type="monotone" dataKey="min" stroke="none" fill="white" fillOpacity={1} legendType="none" />
          <Line type="monotone" dataKey="avg" stroke={color} strokeWidth={2} dot={false} name="avg" />
        </ComposedChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

const DistributionChart: React.FC<{ title: string; pcts: number[]; labels: string[] }> = ({ title, pcts, labels }) => {
  const chartData = labels.map((label, i) => ({ label, pct: pcts[i], color: DIST_COLORS[i] }))
  return (
    <SectionCard title={title} subtitle="% of historical readings">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[0, 100]} />
          <Tooltip formatter={(v: number) => [`${v}%`, '% of readings']} contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e5e7eb' }} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {chartData.map((_, i) => <Cell key={i} fill={DIST_COLORS[i]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </SectionCard>
  )
}

export const NetworkHistory: React.FC = () => {
  const [days, setDays] = useState<Days>(30)
  const { data, isLoading, error } = useNetworkHistory(days)

  const RANGE_OPTIONS: { label: string; value: Days }[] = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
  ]

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Network History</h1>
            <p className="text-gray-600 mt-2">Blended daily performance trends across the entire customer base</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-1.5">
            {RANGE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  days === opt.value
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 mb-6">
            Failed to load history data.
          </div>
        )}

        {isLoading ? <LoadingSkeleton /> : data && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryKpi
                label="Avg Latency"
                value={`${data.summary.avg_latency} ms`}
                sub={`${days}-day period average`}
                color={data.summary.avg_latency > 100 ? 'text-red-600' : data.summary.avg_latency > 50 ? 'text-yellow-600' : 'text-green-600'}
              />
              <SummaryKpi
                label="Avg Packet Loss"
                value={`${data.summary.avg_packet_loss}%`}
                sub={`${days}-day period average`}
                color={data.summary.avg_packet_loss > 5 ? 'text-red-600' : data.summary.avg_packet_loss > 1 ? 'text-yellow-600' : 'text-green-600'}
              />
              <SummaryKpi
                label="Avg Jitter"
                value={`${data.summary.avg_jitter} ms`}
                sub={`${days}-day period average`}
                color={data.summary.avg_jitter > 20 ? 'text-red-600' : data.summary.avg_jitter > 10 ? 'text-yellow-600' : 'text-green-600'}
              />
              <SummaryKpi
                label="Avg SNR"
                value={`${data.summary.avg_snr} dB`}
                sub={`${days}-day period average`}
                color={data.summary.avg_snr < 20 ? 'text-red-600' : data.summary.avg_snr < 30 ? 'text-yellow-600' : 'text-green-600'}
              />
            </div>

            <HealthTrendChart data={data.daily} days={days} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MetricTrendChart
                data={data.daily} days={days}
                avgKey="avg_latency" minKey="min_latency" maxKey="max_latency"
                title="Latency Trend" unit="ms" color="#6366f1"
                refLines={[{ value: 50, label: 'Good', color: '#22c55e' }, { value: 100, label: 'Warn', color: '#f59e0b' }]}
              />
              <MetricTrendChart
                data={data.daily} days={days}
                avgKey="avg_packet_loss" minKey="min_packet_loss" maxKey="max_packet_loss"
                title="Packet Loss Trend" unit="%" color="#f59e0b"
                refLines={[{ value: 1, label: 'Good', color: '#22c55e' }, { value: 5, label: 'Warn', color: '#f59e0b' }]}
              />
              <MetricTrendChart
                data={data.daily} days={days}
                avgKey="avg_jitter" minKey="min_jitter" maxKey="max_jitter"
                title="Jitter Trend" unit="ms" color="#ec4899"
                refLines={[{ value: 10, label: 'Good', color: '#22c55e' }, { value: 20, label: 'Warn', color: '#f59e0b' }]}
              />
              <MetricTrendChart
                data={data.daily} days={days}
                avgKey="avg_snr" minKey="min_snr" maxKey="max_snr"
                title="SNR Trend" unit="dB" color="#0ea5e9"
                refLines={[{ value: 30, label: 'Good', color: '#22c55e' }, { value: 20, label: 'Warn', color: '#f59e0b' }]}
              />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Metric Distributions
                <span className="ml-2 text-sm font-normal text-gray-500">
                  over {days} days · {data.distribution.total.toLocaleString()} readings
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <DistributionChart title="Latency"     pcts={data.distribution.latency}     labels={DIST_LABELS.latency} />
                <DistributionChart title="Packet Loss" pcts={data.distribution.packet_loss} labels={DIST_LABELS.packet_loss} />
                <DistributionChart title="Jitter"      pcts={data.distribution.jitter}      labels={DIST_LABELS.jitter} />
                <DistributionChart title="SNR"         pcts={data.distribution.snr}         labels={DIST_LABELS.snr} />
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
