'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export const Navigation: React.FC = () => {
  const { user, logout } = useAuth()

  return (
    <nav className="bg-gray-900 text-white shadow-lg" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
          >
            <span>SmartView</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2">
              Dashboard
            </Link>
            <Link href="/customers" className="hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2">
              Customers
            </Link>
            <Link href="/network-history" className="hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2">
              Network History
            </Link>
            {user?.role === 'admin' && (
              <Link href="/admin" className="hover:text-gray-300 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2">
                Admin
              </Link>
            )}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-gray-700">
                <span className="text-xs text-gray-400">{user.email}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-300 hover:text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
