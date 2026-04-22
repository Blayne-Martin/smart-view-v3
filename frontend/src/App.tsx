import React from 'react'
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
} from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { FleetDashboard } from '@/components/Dashboard/FleetDashboard'
import { CustomerList } from '@/components/Customers/CustomerList'
import { CustomerDetail } from '@/components/Customers/CustomerDetail'
import { NetworkHistory } from '@/components/NetworkHistory/NetworkHistory'
import { LoginPage } from '@/components/Auth/LoginPage'
import { ProtectedRoute } from '@/components/Auth/ProtectedRoute'
import { AdminPage } from '@/components/Admin/AdminPage'
import { DeviceList } from '@/components/Devices/DeviceList'
import { DeviceTopology } from '@/components/Devices/DeviceTopology'
import { DeviceDetail } from '@/components/Devices/DeviceDetail'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

const Navigation: React.FC = () => {
  const { user, logout } = useAuth()

  return (
    <nav
      className="bg-gray-900 text-white shadow-lg"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            to="/"
            className="flex items-center gap-2 text-2xl font-bold
              hover:text-gray-300 transition-colors duration-200
              focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
          >
            <span aria-hidden="true"></span>
            <span>SmartView</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="hover:text-gray-300 transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2"
            >
              Dashboard
            </Link>
            <Link
              to="/customers"
              className="hover:text-gray-300 transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2"
            >
              Customers
            </Link>
            <Link
              to="/network-history"
              className="hover:text-gray-300 transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2"
            >
              Network History
            </Link>
            {user?.role === 'admin' && (
              <Link
                to="/admin"
                className="hover:text-gray-300 transition-colors duration-200
                  focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-3 py-2"
              >
                Admin
              </Link>
            )}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-gray-700">
                <span className="text-xs text-gray-400">{user.email}</span>
                <button
                  onClick={logout}
                  className="text-sm text-gray-300 hover:text-white transition-colors duration-200
                    focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
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

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col">
    <Navigation />
    {children}
  </div>
)

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <FleetDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CustomerList />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CustomerDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/network-history"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NetworkHistory />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AppLayout>
                    <AdminPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/devices"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DeviceList />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/devices/topology"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DeviceTopology />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers/:customerId/devices/:deviceId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DeviceDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}

export default App
