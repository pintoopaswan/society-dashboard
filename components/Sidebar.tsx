'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, BookOpen, Search, Users, AlertCircle, Grid } from 'lucide-react'
import { api } from '@/lib/api'

interface NavItem { label: string; href: string; icon: any; badge?: number | string }

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard',    icon: LayoutDashboard },
  { label: 'Payments',  href: '/payments',     icon: CreditCard      },
  { label: 'Expense', href: '/expenses',icon: BookOpen        },
  { label: 'Flat Search', href: '/search',     icon: Search          },
]

const DIR_NAV: NavItem[] = [
  { label: 'Residents', href: '/residents', icon: Users },
  { label: 'Emergency', href: '/emergency', icon: AlertCircle },
]

export default function Sidebar({ mobileOpen, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(false)
  const [residentsCount, setResidentsCount] = useState<number | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const d = await api.getDashboard()
        if (!mounted) return
        setResidentsCount(d.residents?.total ?? null)
      } catch (_) {}
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => { if (mobileOpen && onMobileClose) onMobileClose() }, [pathname])

  const isActive = (href: string) => pathname === href || pathname?.startsWith(href)

  return (
    <>
      {mobileOpen && <div onClick={onMobileClose} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.12)' }} />}

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} style={mobileOpen ? { transform: 'translateX(0)' } : undefined}>
        <div className="sidebar-header">
          <div className="logo-mark">A</div>
          <div className="logo-text">
            <h2>MIG Society</h2>
            <p>Sector-29 · Admin Panel</p>
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(s => !s)} aria-label="Toggle sidebar">⤵</button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group">
            <div className="nav-group-title">Main Menu</div>
            {MAIN_NAV.map(item => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </div>

          <div className="nav-group" style={{ marginTop: 12 }}>
            <div className="nav-group-title">Directory</div>
            {DIR_NAV.map(item => (
              <NavLink key={item.href} item={{ ...item, badge: item.label === 'Residents' ? (residentsCount ?? '—') : (item.badge ?? undefined) }} active={isActive(item.href)} />
            ))}
          </div>
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>A</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Admin</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Society Manager</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link href={item.href} className={`nav-item ${active ? 'active' : ''}`}>
      <span className="nav-icon"><Icon size={16} /></span>
      <span className="nav-label">{item.label}</span>
      {item.badge !== undefined && <span className="nav-badge">{item.badge}</span>}
    </Link>
  )
}
