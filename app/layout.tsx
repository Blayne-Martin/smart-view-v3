import type { Metadata } from 'next'
import './globals.css'
import { ReactQueryProvider } from '@/components/ReactQueryProvider'

export const metadata: Metadata = {
  title: 'SmartView',
  description: 'ISP modem performance monitoring dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  )
}
