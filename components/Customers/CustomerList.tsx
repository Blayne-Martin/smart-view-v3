'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomers } from '@/hooks/useCustomers'
import { HealthStatusFilter, HealthStatus } from '@/components/Filters/HealthStatusFilter'
import { Customer } from '@/api/client'

export const CustomerList: React.FC = () => {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<HealthStatus>('All')
  const [currentPage, setCurrentPage] = useState(0)
  const pageSize = 50

  const statusFilter = selectedStatus === 'All' ? undefined
    : selectedStatus === 'Good' ? 'Good'
    : selectedStatus === 'Warn' ? 'Warn'
    : 'Bad' as 'Good' | 'Warn' | 'Bad'

  const { data: response, isLoading, error } = useCustomers(
    pageSize,
    currentPage * pageSize,
    searchQuery,
    statusFilter
  )

  const customers = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  const handleRowClick = (customerId: string) => {
    router.push(`/customers/${customerId}`)
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(0)
  }

  const handleStatusChange = (status: HealthStatus) => {
    setSelectedStatus(status)
    setCurrentPage(0)
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-2">View and manage customer accounts and their modem status</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8">
          <div className="mb-6">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Customers
            </label>
            <input
              id="search"
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              aria-label="Search customers by name or email"
            />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Status</h3>
            <HealthStatusFilter
              selectedStatus={selectedStatus}
              onStatusChange={handleStatusChange}
              ariaLabel="Filter customers by modem health status"
            />
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 mb-8">
            <h3 className="font-semibold">Error loading customers</h3>
            <p className="text-sm">{(error as Error).message}</p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl shadow overflow-hidden">
          {isLoading ? (
            <div role="status" aria-live="polite" className="p-8 text-center text-gray-600">
              Loading customers...
            </div>
          ) : customers.length === 0 ? (
            <div role="status" className="p-8 text-center text-gray-600">No customers found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table role="grid" aria-label="Customer list" className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                      <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                      <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                      <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Created</th>
                      <th scope="col" className="px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer: Customer, index) => (
                      <tr
                        key={customer.id}
                        onClick={() => handleRowClick(customer.id)}
                        className={`
                          border-b border-gray-200 cursor-pointer hover:bg-gray-50
                          transition-colors duration-200
                          ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                        `}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRowClick(customer.id) }}
                        aria-label={`View customer ${customer.name}`}
                      >
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{customer.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{customer.email}</td>
                        <td className="px-6 py-4 text-sm">
                          {customer.health_score ? (
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                              customer.health_score === 'Good' ? 'bg-green-100 text-green-800 border-green-300'
                              : customer.health_score === 'Warn' ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                            }`}>
                              {customer.health_score === 'Good' ? 'Healthy' : customer.health_score === 'Warn' ? 'Warning' : 'Critical'}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(customer.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRowClick(customer.id) }}
                            className="text-blue-600 hover:text-blue-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                            aria-label={`View details for ${customer.name}`}
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Showing <span className="font-medium">{currentPage * pageSize + 1}</span> to{' '}
                    <span className="font-medium">{Math.min((currentPage + 1) * pageSize, total)}</span> of{' '}
                    <span className="font-medium">{total}</span> customers
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Previous page"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-600" aria-live="polite" aria-label={`Page ${currentPage + 1} of ${totalPages}`}>
                      Page {currentPage + 1} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                      disabled={currentPage === totalPages - 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  )
}
