'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useFleetSummary, useWorstPerformers, useFleetDistribution } from '@/hooks/useFleetDashboard'
import { HealthStatusFilter, HealthStatus } from '@/components/Filters/HealthStatusFilter'
import { MetricDistributionCharts } from '@/components/Dashboard/MetricDistributionCharts'
import { ModemStat } from '@/api/client'

interface SummaryTileProps {
  title: string
  value: number
  icon: string
  color: string
  pct?: number
  onClick?: () => void
  ariaLabel: string
}

const SummaryTile: React.FC<SummaryTileProps> = ({ title, value, icon, color, pct, onClick, ariaLabel }) => {
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`
        p-6 bg-white border border-gray-200 rounded-2xl
        transition-all duration-300
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-gray-300' : ''}
        ${prefersReducedMotion ? '' : 'transform hover:scale-105'}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {pct !== undefined && (
            <p className={`text-sm font-medium mt-1 ${color}`}>{pct}% of base</p>
          )}
        </div>
        <div className={`text-4xl ${color} opacity-20`}>{icon}</div>
      </div>
    </button>
  )
}

interface WorstPerformersTableProps {
  data: ModemStat[]
  isLoading: boolean
  onRowClick?: (customerId: string) => void
}

const WorstPerformersTable: React.FC<WorstPerformersTableProps> = ({ data, isLoading, onRowClick }) => {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="p-8 text-center text-gray-600">
        Loading worst performers...
      </div>
    )
  }

  if (!data || data.length === 0) {
    return <div role="status" className="p-8 text-center text-gray-600">No data available</div>
  }

  const getStatusBadge = (status: 'Good' | 'Warn' | 'Bad') => {
    const styles = {
      Good: 'bg-green-100 text-green-800 border-green-300',
      Warn: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      Bad:  'bg-red-100 text-red-800 border-red-300',
    }
    return styles[status]
  }

  return (
    <div className="overflow-x-auto">
      <table role="grid" aria-label="Worst performing modems" className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th scope="col" className="px-6 py-3 text-left font-semibold text-gray-900">Customer ID</th>
            <th scope="col" className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
            <th scope="col" className="px-6 py-3 text-right font-semibold text-gray-900">Latency (ms)</th>
            <th scope="col" className="px-6 py-3 text-right font-semibold text-gray-900">Packet Loss (%)</th>
            <th scope="col" className="px-6 py-3 text-right font-semibold text-gray-900">Jitter (ms)</th>
            <th scope="col" className="px-6 py-3 text-right font-semibold text-gray-900">SNR (dB)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((modem, index) => (
            <tr
              key={modem.id}
              onClick={() => onRowClick?.(modem.customer_id)}
              className={`
                border-b border-gray-200
                ${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                transition-colors duration-200
                ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              `}
              role="button"
              tabIndex={onRowClick ? 0 : -1}
              aria-label={`Customer ${modem.customer_id} with ${modem.health_score} health status`}
              onKeyDown={(e) => { if (e.key === 'Enter' && onRowClick) onRowClick(modem.customer_id) }}
            >
              <td className="px-6 py-4 font-medium text-gray-900">{modem.customer_id}</td>
              <td className="px-6 py-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(modem.health_score)}`}>
                  {modem.health_score === 'Good' ? 'Healthy' : modem.health_score === 'Warn' ? 'Warning' : 'Critical'}
                </span>
              </td>
              <td className="px-6 py-4 text-right text-gray-600">{modem.latency.toFixed(2)}</td>
              <td className="px-6 py-4 text-right text-gray-600">{modem.packet_loss.toFixed(2)}</td>
              <td className="px-6 py-4 text-right text-gray-600">{modem.jitter.toFixed(2)}</td>
              <td className="px-6 py-4 text-right text-gray-600">{modem.snr.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const FleetDashboard: React.FC = () => {
  const router = useRouter()
  const [selectedStatus, setSelectedStatus] = useState<HealthStatus>('All')
  const { data: summary, isLoading: summaryLoading } = useFleetSummary()
  const { data: fleetDistribution, isLoading: metricsLoading } = useFleetDistribution()
  const { data: worstPerformers, isLoading: performersLoading } = useWorstPerformers(
    selectedStatus === 'All' ? undefined : selectedStatus === 'Good' ? 'Good' : selectedStatus === 'Warn' ? 'Warn' : 'Bad'
  )

  const handleRowClick = (customerId: string) => {
    router.push(`/customers/${customerId}`)
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Network Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Real-time monitoring of modem health and performance across your network
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <SummaryTile
            title="Total Customers"
            value={summary?.total || 0}
            icon="👥"
            color="text-blue-600"
            ariaLabel={`Total customers: ${summary?.total || 0}`}
          />
          <SummaryTile
            title="Healthy"
            value={summary?.healthy || 0}
            icon="✓"
            color="text-green-600"
            pct={summary?.total ? Math.round((summary.healthy / summary.total) * 100) : undefined}
            onClick={() => setSelectedStatus('Good')}
            ariaLabel={`Healthy modems: ${summary?.healthy || 0}. Click to filter.`}
          />
          <SummaryTile
            title="Warning"
            value={summary?.warning || 0}
            icon="⚠"
            color="text-yellow-600"
            pct={summary?.total ? Math.round((summary.warning / summary.total) * 100) : undefined}
            onClick={() => setSelectedStatus('Warn')}
            ariaLabel={`Warning modems: ${summary?.warning || 0}. Click to filter.`}
          />
          <SummaryTile
            title="Critical"
            value={summary?.critical || 0}
            icon="✕"
            color="text-red-600"
            pct={summary?.total ? Math.round((summary.critical / summary.total) * 100) : undefined}
            onClick={() => setSelectedStatus('Bad')}
            ariaLabel={`Critical modems: ${summary?.critical || 0}. Click to filter.`}
          />
        </div>

        <MetricDistributionCharts data={fleetDistribution} isLoading={metricsLoading} />

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filter by Status</h2>
          <HealthStatusFilter
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            counts={summary ? { all: summary.total, good: summary.healthy, warn: summary.warning, bad: summary.critical } : undefined}
          />
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Worst Performers</h2>
            <p className="text-sm text-gray-600 mt-1">Top 10 modems requiring attention</p>
          </div>
          <WorstPerformersTable
            data={worstPerformers || []}
            isLoading={performersLoading}
            onRowClick={handleRowClick}
          />
        </div>
      </div>
    </main>
  )
}
