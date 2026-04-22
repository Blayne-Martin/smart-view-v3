import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDevices } from '@/hooks/useDevices'
import { DeviceWithStats, ConnectionType } from '@/api/client'
import { DeviceTypeIcon } from './DeviceTypeIcon'

// ── Connection badge ──────────────────────────────────────────────────────────

const CONN_LABELS: Record<ConnectionType, string> = {
  ethernet: 'Ethernet',
  wifi_2_4: 'WiFi 2.4 GHz',
  wifi_5:   'WiFi 5 GHz',
  wifi_6:   'WiFi 6',
}

const CONN_COLOURS: Record<ConnectionType, string> = {
  ethernet: 'bg-blue-100 text-blue-800',
  wifi_2_4: 'bg-yellow-100 text-yellow-800',
  wifi_5:   'bg-purple-100 text-purple-800',
  wifi_6:   'bg-green-100 text-green-800',
}

const ConnectionBadge: React.FC<{ type: ConnectionType }> = ({ type }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONN_COLOURS[type]}`}>
    {CONN_LABELS[type]}
  </span>
)

// ── Online indicator ──────────────────────────────────────────────────────────

const OnlineDot: React.FC<{ isOnline: number | null }> = ({ isOnline }) => {
  if (isOnline === null) return <span className="text-gray-400 text-xs">—</span>
  return isOnline
    ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" title="Online" aria-label="Online" />
    : <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-400"   title="Offline" aria-label="Offline" />
}

// ── Row ───────────────────────────────────────────────────────────────────────

const DeviceRow: React.FC<{ device: DeviceWithStats; customerId: string }> = ({ device, customerId }) => {
  const isWifi = device.connection_type !== 'ethernet'
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <DeviceTypeIcon type={device.device_type} showLabel />
      </td>
      <td className="px-4 py-3">
        <Link
          to={`/customers/${customerId}/devices/${device.id}`}
          className="text-blue-600 hover:underline font-medium text-sm"
        >
          {device.name}
        </Link>
      </td>
      <td className="px-4 py-3">
        <ConnectionBadge type={device.connection_type} />
      </td>
      <td className="px-4 py-3 text-center">
        <OnlineDot isOnline={device.is_online} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 text-right">
        {isWifi && device.rssi_dbm !== null ? `${device.rssi_dbm} dBm` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 text-right">
        {device.upload_mbps !== null ? `${device.upload_mbps?.toFixed(1)} Mbps` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 text-right">
        {device.download_mbps !== null ? `${device.download_mbps?.toFixed(1)} Mbps` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 text-right">
        {device.latency_ms !== null ? `${device.latency_ms?.toFixed(1)} ms` : '—'}
      </td>
    </tr>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export const DeviceList: React.FC = () => {
  const { customerId } = useParams<{ customerId: string }>()
  const [offset, setOffset] = useState(0)

  const { data, isLoading, isError } = useDevices(customerId ?? '', PAGE_SIZE, offset)

  if (!customerId) return null

  return (
    <main className="min-h-screen bg-gray-100 py-8" role="main" aria-label="Device list">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-6 bg-white border border-gray-200 rounded-2xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <nav aria-label="Breadcrumb" className="text-sm text-gray-500 mb-1">
                <Link to={`/customers/${customerId}`} className="hover:underline text-blue-600">
                  Customer Detail
                </Link>
                {' / '}
                <span>In-Home Devices</span>
              </nav>
              <h1 className="text-2xl font-bold text-gray-900">In-Home Devices</h1>
              {data && (
                <p className="text-sm text-gray-500 mt-1">{data.pagination.total} device{data.pagination.total !== 1 ? 's' : ''} found</p>
              )}
            </div>
            <Link
              to={`/customers/${customerId}/devices/topology`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              View Topology
            </Link>
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-800 mb-6">
            Failed to load devices.
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
            Loading devices...
          </div>
        )}

        {/* Table */}
        {data && data.data.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left" role="table" aria-label="Device list">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Type', 'Name', 'Connection', 'Online', 'RSSI', 'Upload', 'Download', 'Latency'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide" role="columnheader">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map((device) => (
                    <DeviceRow key={device.id} device={device} customerId={customerId} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pagination.total > PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, data.pagination.total)} of {data.pagination.total}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={!data.pagination.hasMore}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {data && data.data.length === 0 && !isLoading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-500">
            No devices found for this customer.
          </div>
        )}
      </div>
    </main>
  )
}
