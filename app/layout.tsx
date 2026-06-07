// app/layout.tsx
import type { Metadata } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import './globals.css'

const display = Syne({ subsets: ['latin'], variable: '--font-display', weight: ['700', '800'] })
const body    = DM_Sans({ subsets: ['latin'], variable: '--font-body', weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title:       'Society Management',
  description: 'Admin dashboard for society management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="bg-surface text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
