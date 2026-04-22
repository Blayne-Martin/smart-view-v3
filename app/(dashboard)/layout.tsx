'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { Navigation } from '@/components/Navigation'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Navigation />
        {children}
      </div>
    </AuthProvider>
  )
}
