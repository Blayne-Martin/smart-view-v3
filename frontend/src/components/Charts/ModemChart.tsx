import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import { ModemStat } from '@/api/client'

export type ChartMetric = 'latency' | 'jitter' | 'packet_loss' | 'snr'

export interface ModemChartProps {
  data: ModemStat[]
  metric: ChartMetric
  title: string
  unit: string
  height?: number
  isLoading?: boolean
  error?: Error | null
}

/**
 * Wrapper around Recharts LineChart with:
 * - Accessibility labels (ARIA, semantic HTML)
 * - prefers-reduced-motion support
 * - Proper color-blind palette
 */
export const ModemChart: React.FC<ModemChartProps> = ({
  data,
  metric,
  title,
  unit,
  height = 300,
  isLoading = false,
  error = null,
}) => {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  const chartData = useMemo(() => {
    return data.map((stat) => ({
      timestamp: new Date(stat.recorded_at).toLocaleTimeString(),
      recordedAt: stat.recorded_at,
      value: stat[metric],
      latency: stat.latency,
      jitter: stat.jitter,
      packet_loss: stat.packet_loss,
      snr: stat.snr,
    }))
  }, [data, metric])

  if (error) {
    return (
      <div
        role="alert"
        className="p-4 bg-red-50 border border-red-200 rounded text-red-800"
      >
        <h3 className="font-semibold">Error loading chart</h3>
        <p className="text-sm">{error.message}</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-4 bg-gray-50 border border-gray-200 rounded h-80 flex items-center justify-center"
      >
        <div className="text-gray-600">Loading chart data...</div>
      </div>
    )
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div
        role="status"
        className="p-4 bg-gray-50 border border-gray-200 rounded h-80 flex items-center justify-center"
      >
        <div className="text-gray-600">No data available</div>
      </div>
    )
  }

  return (
    <figure className="w-full">
      <figcaption className="text-lg font-semibold text-gray-900 mb-4">
        {title}
      </figcaption>
      <div
        className="w-full"
        role="img"
        aria-label={`${title} over time chart showing ${metric} in ${unit}`}
      >
        <ResponsiveContainer width="100%" height={height}>
          <LineChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            animationDuration={prefersReducedMotion ? 0 : 300}
          >
            <defs>
              <linearGradient id={`gradient-${metric}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray={prefersReducedMotion ? '0' : '3 3'}
              stroke="#e5e7eb"
            />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 12 }}
              aria-label="Time"
            />
            <YAxis
              label={{ value: unit, angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
              aria-label={unit}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#fff',
              }}
              formatter={(value: number) => [
                `${value.toFixed(2)} ${unit}`,
                metric.charAt(0).toUpperCase() + metric.slice(1),
              ]}
              labelFormatter={() => chartData[0]?.timestamp || ''}
            />
            <Legend
              wrapperStyle={{ paddingTop: '1rem' }}
              verticalAlign="bottom"
              height={36}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name={metric}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={300}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

/**
 * Multi-metric chart for comparing metrics simultaneously
 */
export interface MultiMetricChartProps {
  data: ModemStat[]
  metrics: ChartMetric[]
  title: string
  height?: number
  isLoading?: boolean
}

const METRIC_CONFIG = {
  latency: { label: 'Latency', unit: 'ms', color: '#ef4444' },
  jitter: { label: 'Jitter', unit: 'ms', color: '#f97316' },
  packet_loss: { label: 'Packet Loss', unit: '%', color: '#eab308' },
  snr: { label: 'SNR', unit: 'dB', color: '#22c55e' },
}

export const MultiMetricChart: React.FC<MultiMetricChartProps> = ({
  data,
  metrics,
  title,
  height = 350,
  isLoading = false,
}) => {
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches

  const chartData = useMemo(() => {
    return data.map((stat) => ({
      timestamp: new Date(stat.recorded_at).toLocaleTimeString(),
      latency: stat.latency,
      jitter: stat.jitter,
      packet_loss: stat.packet_loss,
      snr: stat.snr,
    }))
  }, [data])

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="p-4 bg-gray-50 border border-gray-200 rounded h-96 flex items-center justify-center"
      >
        <div className="text-gray-600">Loading chart data...</div>
      </div>
    )
  }

  return (
    <figure className="w-full">
      <figcaption className="text-lg font-semibold text-gray-900 mb-4">
        {title}
      </figcaption>
      <div
        role="img"
        aria-label={`${title} showing ${metrics.join(', ')} metrics`}
      >
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            animationDuration={prefersReducedMotion ? 0 : 300}
          >
            <CartesianGrid
              strokeDasharray={prefersReducedMotion ? '0' : '3 3'}
              stroke="#e5e7eb"
            />
            <XAxis
              dataKey="timestamp"
              tick={{ fontSize: 12 }}
              aria-label="Time"
            />
            <YAxis
              yAxisId="left"
              label={{
                value: 'Latency / Jitter (ms)',
                angle: -90,
                position: 'insideLeft',
              }}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              label={{
                value: 'Packet Loss (%) / SNR (dB)',
                angle: 90,
                position: 'insideRight',
              }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '0.5rem',
                color: '#fff',
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: '1rem' }}
              verticalAlign="bottom"
              height={36}
            />
            {metrics.includes('latency') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="latency"
                stroke={METRIC_CONFIG.latency.color}
                strokeWidth={2}
                dot={false}
                name="Latency (ms)"
                isAnimationActive={!prefersReducedMotion}
              />
            )}
            {metrics.includes('jitter') && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="jitter"
                stroke={METRIC_CONFIG.jitter.color}
                strokeWidth={2}
                dot={false}
                name="Jitter (ms)"
                isAnimationActive={!prefersReducedMotion}
              />
            )}
            {metrics.includes('packet_loss') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="packet_loss"
                stroke={METRIC_CONFIG.packet_loss.color}
                strokeWidth={2}
                dot={false}
                name="Packet Loss (%)"
                isAnimationActive={!prefersReducedMotion}
              />
            )}
            {metrics.includes('snr') && (
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="snr"
                stroke={METRIC_CONFIG.snr.color}
                strokeWidth={2}
                dot={false}
                name="SNR (dB)"
                isAnimationActive={!prefersReducedMotion}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}
