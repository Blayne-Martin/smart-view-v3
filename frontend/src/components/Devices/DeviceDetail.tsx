import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDevice, useDeviceHistory } from '@/hooks/useDevices'
import { TimeRange } from '@/hooks/useModemHistory'
import { TimeRangeSelector } from '@/components/Filters/TimeRangeSelector'
import { DeviceTypeIcon } from './DeviceTypeIcon'
import { DeviceStatCard } from './DeviceStatCard'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { DeviceHistoryRecord } from '@/api/client'

// ── History chart ─────────────────────────────────────────────────────────────

interface MetricChartProps {
  data: DeviceHistoryRecord[]
  dataKey: keyof DeviceHistoryRecord
  label: string
  unit: string
  color: string
}

const MetricChart: React.FC<MetricChartProps> = ({ data, dataKey, label, unit, color }) => {
  const values = data.map((d) => Number(d[dataKey])).filter((v) => !isNaN(v))
  const avg    = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : 'N/A'
  const min    = values.length ? Math.min(...values).toFixed(1) : 'N/A'
  const max    = values.length ? Math.max(...values).toFixed(1) : 'N/A'

  const formatted = data.map((d) => ({
    ...d,
    _ts: d.recorded_at.substring(5, 16), // MM-DD HH:mm
  }))

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">{label}</h3>
      <p className="text-xs text-gray-400 mb-4">
        avg {avg}{unit} &nbsp;·&nbsp; min {min}{unit} &nbsp;·&nbsp; max {max}{unit}
      </p>
      <div
        role="img"
        aria-label={`${label} over time. Average ${avg}${unit}, min ${min}${unit}, max ${max}${unit}`}
      >
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={formatted} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="_ts"
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              interval="preserveStartEnd"
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <Tooltip
              formatter={(val: number) => [`${val} ${unit}`, label]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Line
              type="monotone"
              dataKey={dataKey as string}
              stroke={color}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const DeviceDetail: React.FC = () => {
  const { customerId, deviceId } = useParams<{ customerId: string; deviceId: string }>()
  const [days, setDays] = useState<TimeRange>(7)

  const { data: device, isLoading: deviceLoading, isError: deviceError } = useDevice(
    customerId ?? '',
    deviceId ?? ''
  )

  const { data: history, isLoading: historyLoading } = useDeviceHistory(
    customerId ?? '',
    deviceId ?? '',
    days
  )

  if (!customerId || !deviceId) return null

  if (deviceLoading) {
    return (
      <main className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center text-gray-500">Loading device...</div>
      </main>
    )
  }

  if (deviceError || !device) {
    return (
      <main className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-800">
            Device not found.
          </div>
        </div>
      </main>
    )
  }

  const isWifi   = device.connection_type !== 'ethernet'
  const isOnline = device.is_online !== 0

  return (
    <main className="min-h-screen bg-gray-100 py-8" role="main" aria-label="Device detail">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Header card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-2">
            <Link to={`/customers/${customerId}`} className="hover:underline text-blue-600">
              Customer
            </Link>
            {' / '}
            <Link to={`/customers/${customerId}/devices`} className="hover:underline text-blue-600">
              Devices
            </Link>
            {' / '}
            <span>{device.name}</span>
          </nav>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <DeviceTypeIcon type={device.device_type} className="text-3xl" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{device.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {device.connection_type.replace(/_/g, ' ')}
                  {device.mac_address && ` · ${device.mac_address}`}
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
              aria-label={isOnline ? 'Online' : 'Offline'}
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Current stats */}
        <section aria-label="Current stats">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Current Stats</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {isWifi && (
              <DeviceStatCard
                label="RSSI"
                value={device.rssi_dbm !== null ? Number(device.rssi_dbm.toFixed(1)) : null}
                unit="dBm"
                isGood={device.rssi_dbm !== null ? device.rssi_dbm > -70 : undefined}
              />
            )}
            <DeviceStatCard
              label="Download"
              value={device.download_mbps !== null ? Number(device.download_mbps?.toFixed(1)) : null}
              unit="Mbps"
              isGood={device.download_mbps !== null ? device.download_mbps > 10 : undefined}
            />
            <DeviceStatCard
              label="Upload"
              value={device.upload_mbps !== null ? Number(device.upload_mbps?.toFixed(1)) : null}
              unit="Mbps"
              isGood={device.upload_mbps !== null ? device.upload_mbps > 2 : undefined}
            />
            <DeviceStatCard
              label="Latency"
              value={device.latency_ms !== null ? Number(device.latency_ms?.toFixed(1)) : null}
              unit="ms"
              isGood={device.latency_ms !== null ? device.latency_ms < 20 : undefined}
            />
          </div>
        </section>

        {/* Time range + history charts */}
        <section aria-label="Historical data">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Historical Data</h2>
            <TimeRangeSelector
              selectedRange={days}
              onRangeChange={setDays}
              ariaLabel="Select time range for device history charts"
            />
          </div>

          {historyLoading && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
              Loading history...
            </div>
          )}

          {history && history.data.length > 0 && (
            <div className="space-y-4">
              <MetricChart
                data={history.data}
                dataKey="download_mbps"
                label="Download"
                unit=" Mbps"
                color="#3b82f6"
              />
              <MetricChart
                data={history.data}
                dataKey="upload_mbps"
                label="Upload"
                unit=" Mbps"
                color="#10b981"
              />
              <MetricChart
                data={history.data}
                dataKey="latency_ms"
                label="Latency"
                unit=" ms"
                color="#f59e0b"
              />
              {isWifi && (
                <MetricChart
                  data={history.data}
                  dataKey="rssi_dbm"
                  label="RSSI (Signal Strength)"
                  unit=" dBm"
                  color="#8b5cf6"
                />
              )}
              {history.samplingApplied && (
                <p className="text-xs text-gray-400 text-right">
                  Data was downsampled for visualisation.
                </p>
              )}
            </div>
          )}

          {history && history.data.length === 0 && !historyLoading && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-500">
              No history data for this time range.
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
