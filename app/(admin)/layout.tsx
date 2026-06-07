'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { supabase, signOut } from '@/lib/supabase'
import FlatSearch from './flat-search/FlatSearch'

const NAV = [
  { href: '/dashboard', label: 'Dashboard',  icon: 'ti-layout-dashboard' },
  { href: '/flats',     label: 'Flats',      icon: 'ti-building' },
  { href: '/residents', label: 'Residents',  icon: 'ti-users' },
  { href: '/payments',  label: 'Payments',   icon: 'ti-credit-card' },
  { href: '/expenses',  label: 'Expenses',   icon: 'ti-receipt' },
  { href: '/search',    label: 'Search',     icon: 'ti-search' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [open, setOpen]     = useState(false)
  const [user, setUser]     = useState<any>(null)
  const [loggingOut, setLO] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    setLO(true); await signOut(); router.push('/login')
  }

  const isActive = (href: string) => pathname.startsWith(href)

  return (
    <div className="flex min-h-screen bg-gray-50 text-slate-900">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex flex-col w-[220px] fixed h-full z-20 bg-white border-r border-gray-200">

        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-200">
          <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white font-bold text-sm flex items-center justify-center mb-2">M</div>
          <div className="text-sm font-semibold text-slate-900">MIG-1 Society</div>
          <div className="text-xs text-slate-500 mt-0.5">Sector-29 · Admin Panel</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2">Main Menu</div>
          {NAV.map(({ href, label, icon }) => (
            <Link key={href} href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1 ${isActive(href) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-50'}`}>
              <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 16, width: 18, textAlign: 'center' }} />
              {label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-3 border-t border-gray-200">
          {user ? (
            <>
              <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-gray-50 mb-2">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 font-semibold text-xs flex items-center justify-center flex-shrink-0">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{user.email}</div>
                  <div className="text-xs text-slate-500">Admin</div>
                </div>
              </div>
              <button onClick={handleSignOut} disabled={loggingOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors">
                <i className="ti ti-logout" aria-hidden style={{ fontSize: 15 }} />
                {loggingOut ? 'Signing out…' : 'Sign Out'}
              </button>
            </>
          ) : (
            <Link href="/login" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-gray-50 transition-colors">
              <i className="ti ti-login" aria-hidden style={{ fontSize: 16 }} />
              Admin Login
            </Link>
          )}
        </div>
      </aside>

      {/* ── Mobile sidebar ── */}
      {open && (
        <div className="fixed inset-0 z-30 md:hidden">
          <div className="absolute inset-0 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-200">
              <div className="text-sm font-semibold text-slate-900">MIG-1 Society</div>
              <button onClick={() => setOpen(false)} className="text-slate-600">
                <i className="ti ti-x" style={{ fontSize: 20 }} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-3">
              {NAV.map(({ href, label, icon }) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors mb-1 ${isActive(href) ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:text-slate-900 hover:bg-gray-50'}`}>
                  <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 17, width: 18, textAlign: 'center' }} />
                  {label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col md:ml-[220px]">

        {/* Topbar */}
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-6">
          <button className="md:hidden text-slate-600" onClick={() => setOpen(true)}>
            <i className="ti ti-menu-2" style={{ fontSize: 22 }} />
          </button>
          <div className="md:hidden text-sm font-semibold text-slate-900">MIG-1 Society</div>

          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span className="hidden sm:inline text-sm font-semibold text-emerald-600">System Online</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:block text-sm text-slate-600">{user.email}</span>
                <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-semibold">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
              </div>
            ) : (
              <Link href="/login" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm">
                <i className="ti ti-login" aria-hidden /> Login
              </Link>
            )}
          </div>
        </header>

        {/* Page */}
        <main className="flex-1 p-6">
          <div className="max-w-[1200px] w-full mx-auto">{children}</div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-200 px-6 py-3 bg-white text-center">
          <span className="text-xs text-slate-500">Developed by Pintoo Paswan · MIG-1 Society Management</span>
        </footer>
      </div>

      {/* Tabler icons */}
      <FlatSearch />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
    </div>
  )
}