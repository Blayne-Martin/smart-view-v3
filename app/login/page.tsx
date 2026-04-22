export const dynamic = 'force-dynamic'

import { LoginPage } from '@/components/Auth/LoginPage'
import { AuthProvider } from '@/contexts/AuthContext'

export default function LoginRoute() {
  return (
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  )
}
