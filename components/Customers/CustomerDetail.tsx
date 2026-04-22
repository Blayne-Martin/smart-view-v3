'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useCustomer } from '@/hooks/useCustomers'
import { useModemStats, getHealthColor } from '@/hooks/useModemStats'
import { useModemHistory, useTimeRange, TimeRange } from '@/hooks/useModemHistory'
import { TimeRangeSelector } from '@/components/Filters/TimeRangeSelector'
import { ModemChart, MultiMetricChart } from '@/components/Charts/ModemChart'

interface GaugeProps {
  label: string
  value: number
  unit: string
  min: number
  max: number
  warningThreshold: number
  ariaLabel: string
}

const Gauge: React.FC<GaugeProps> = ({ label, value, unit, min, max, warningThreshold, ariaLabel }) => {
  const percentage = ((value - min) / (max - min)) * 100
  const isWarning = value > warningThreshold

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">{label}</h3>
      <div role="img" aria-label={ariaLabel} className="flex flex-col items-center justify-center">
        <div className="relative w-24 h-24 mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={isWarning ? '#ef4444' : '#22c55e'}
              strokeWidth="8"
              strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
              transform="rotate(-90 50 50)"
              style={{ transition: 'stroke-dasharray 0.3s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{value.toFixed(1)}</p>
              <p className="text-xs text-gray-600">{unit}</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-600 text-center">
          {isWarning ? `⚠ Above threshold (${warningThreshold}${unit})` : `✓ Normal`}
        </p>
      </div>
    </div>
  )
}

export const CustomerDetail: React.FC = () => {
  const params = useParams<{ customerId: string }>()
  const customerId = params?.customerId ?? ''
  const [timeRange, setTimeRange] = useTimeRange(7)

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId)
  const { data: currentStats, isLoading: statsLoading } = useModemStats(customerId)
  const { data: history, isLoading: historyLoading } = useModemHistory(customerId, timeRange)

  if (customerLoading) {
    return (
      <main className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-600">Loading customer details...</p>
        </div>
      </main>
    )
  }

  if (!customer) {
    return (
      <main className="min-h-screen bg-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-800">
            Customer not found
          </div>
        </div>
      </main>
    )
  }

  const healthColor = currentStats ? getHealthColor(currentStats.health_score) : '#999'

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{customer.name}</h1>
                <p className="text-gray-600 mt-1">{customer.email}</p>
                <p className="text-sm text-gray-500 mt-2">Customer ID: {customer.id}</p>
                <Link
                  href={`/customers/${customerId}/devices`}
                  className="inline-block mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  In-Home Devices
                </Link>
              </div>
              {currentStats && (
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{ backgroundColor: healthColor }}
                    role="img"
                    aria-label={`Health status: ${currentStats.health_score}`}
                  >
                    {currentStats.health_score === 'Good' ? '✓' : currentStats.health_score === 'Warn' ? '⚠' : '✕'}
                  </div>
                  <p className="text-sm font-medium mt-2">
                    {currentStats.health_score === 'Good' ? 'Healthy' : currentStats.health_score === 'Warn' ? 'Warning' : 'Critical'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {currentStats && !statsLoading && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Metrics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Gauge label="Latency"     value={currentStats.latency}     unit="ms" min={0} max={200} warningThreshold={100} ariaLabel={`Latency: ${currentStats.latency} milliseconds`} />
              <Gauge label="Jitter"      value={currentStats.jitter}      unit="ms" min={0} max={50}  warningThreshold={20}  ariaLabel={`Jitter: ${currentStats.jitter} milliseconds`} />
              <Gauge label="Packet Loss" value={currentStats.packet_loss} unit="%"  min={0} max={10}  warningThreshold={5}   ariaLabel={`Packet Loss: ${currentStats.packet_loss}%`} />
              <Gauge label="SNR"         value={currentStats.snr}         unit="dB" min={0} max={50}  warningThreshold={20}  ariaLabel={`Signal-to-Noise Ratio: ${currentStats.snr} dB`} />
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Historical Data</h2>
          <TimeRangeSelector
            selectedRange={timeRange}
            onRangeChange={setTimeRange}
            ariaLabel="Select time range for historical charts"
          />
        </div>

        {history && (
          <div className="space-y-8 mb-8">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <MultiMetricChart
                data={history.data}
                metrics={['latency', 'jitter', 'packet_loss', 'snr']}
                title="All Metrics"
                height={400}
                isLoading={historyLoading}
              />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <ModemChart data={history.data} metric="latency" title="Latency Over Time" unit="ms" height={350} isLoading={historyLoading} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <ModemChart data={history.data} metric="packet_loss" title="Packet Loss Over Time" unit="%" height={350} isLoading={historyLoading} />
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <ModemChart data={history.data} metric="snr" title="Signal-to-Noise Ratio Over Time" unit="dB" height={350} isLoading={historyLoading} />
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
