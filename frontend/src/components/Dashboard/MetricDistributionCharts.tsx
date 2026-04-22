import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { FleetDistribution } from '@/hooks/useFleetDashboard'

const COLORS = ['#22c55e', '#86efac', '#facc15', '#f97316', '#ef4444']

const LABELS = {
  latency:     ['≤20ms', '21-50ms', '51-100ms', '101-200ms', '>200ms'],
  packet_loss: ['≤0.5%', '0.5-1%', '1-5%', '5-10%', '>10%'],
  jitter:      ['≤5ms', '5-10ms', '11-20ms', '21-50ms', '>50ms'],
  snr:         ['>35dB', '30-35dB', '25-30dB', '20-25dB', '≤20dB'],
}

type MetricKey = keyof typeof LABELS

function toChartData(pcts: number[], metric: MetricKey) {
  return LABELS[metric].map((label, i) => ({ label, pct: pcts[i], color: COLORS[i] }))
}

interface ChartPanelProps {
  title: string
  data: { label: string; pct: number; color: string }[]
}

const ChartPanel: React.FC<ChartPanelProps> = ({ title, data }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-5">
    <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} domain={[0, 100]} />
        <Tooltip
          formatter={(value: number) => [`${value}%`, '% of customers']}
          contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e5e7eb' }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Bar dataKey="pct" radius={[3, 3, 0, 0]} maxBarSize={48}>
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
)

interface MetricDistributionChartsProps {
  data: FleetDistribution | undefined
  isLoading: boolean
}

export const MetricDistributionCharts: React.FC<MetricDistributionChartsProps> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Metric Distributions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 h-[236px] animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Metric Distributions
        <span className="ml-2 text-sm font-normal text-gray-500">({data.total.toLocaleString()} customers)</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChartPanel title="Latency"      data={toChartData(data.latency,     'latency')}     />
        <ChartPanel title="Packet Loss"  data={toChartData(data.packet_loss, 'packet_loss')} />
        <ChartPanel title="Jitter"       data={toChartData(data.jitter,      'jitter')}      />
        <ChartPanel title="SNR"          data={toChartData(data.snr,         'snr')}         />
      </div>
    </div>
  )
}
