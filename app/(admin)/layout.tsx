'use client'
// app/(admin)/layout.tsx
// Wraps every admin page with the premium sidebar + topbar shell

import { useState, useEffect } from 'react'
import Sidebar from '@/components/Sidebar'
import { RefreshCw, ChevronDown, Menu } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="layout">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content shifts right on desktop, full-width on mobile */}
      <div className="main-content" id="main-content">
        {/* ── Top bar ── */}
        <header className="topbar">
          {/* Hamburger — mobile only */}
          <button
            className="hamburger-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>

          {/* Breadcrumb / title */}
          <div className="topbar-brand">
            <h1>Dashboard Overview</h1>
            <p>MIG Society, Sector-29 · Guard Payment KPIs &amp; trends</p>
          </div>

          {/* Controls */}
          <div className="topbar-actions">
            <button className="pill-select hide-mobile">
              2026 <ChevronDown size={12} style={{ color: 'var(--slate-400)' }} />
            </button>

            <button className="pill-select hide-mobile">
              All Months <ChevronDown size={12} style={{ color: 'var(--slate-400)' }} />
            </button>

            <button className="btn-primary" onClick={() => window.location.reload()}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  )
}