import type { Metadata } from 'next'
import { inter } from './fonts'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: 'RepReady',
  description: 'AI-powered sales call simulation training',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
