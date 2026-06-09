'use client'
// app/(admin)/dashboard/page.tsx  — Premium redesign
import { useEffect, useState } from 'react'
import { api, DashboardData } from '@/lib/api'
import {
  TrendingUp, Wallet, Building2, Users,
  AlertTriangle, CheckCircle2, Clock,
  RefreshCw, CreditCard, BookOpen, Search, AlertCircle,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

// ─── Stat card ───────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub,
  variant = 'brand', delay = '', trendLabel = '', trendColor = ''
}: any) {
  return (
    <div className={`stat-card ${variant} fade-up ${delay}`}>
      <div className="stat-icon"><Icon size={18} /></div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
      {trendLabel && (
        <span className="stat-trend" style={{
          background: trendColor ? `var(--${trendColor}-50)` : 'var(--emerald-50)',
          color:      trendColor ? `var(--${trendColor}-600)` : 'var(--emerald-600)',
        }}>
          {trendLabel}
        </span>
      )}
    </div>
  )
}

// ─── Status badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID:    'badge badge-paid',
    PENDING: 'badge badge-pending',
    OVERDUE: 'badge badge-overdue',
  }
  return <span className={map[status] ?? 'badge badge-vacant'}>{status}</span>
}

// ─── Card title ──────────────────────────────────────────────
function CardTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <p className="section-label">{children}</p>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = async () => {
    setLoading(true)
    try   { setData(await api.getDashboard()) }
    catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)', gap: 10 }}>
      <RefreshCw size={22} className="spinner" /> Loading dashboard…
    </div>
  )

  if (error) return (
    <div className="card" style={{ color: 'var(--red-500)', fontSize: 13 }}>⚠ {error}</div>
  )

  if (!data) return null

  const { flats, residents, currentMonth, fund, recentPayments, topDefaulters } = data

  // Today's collection
  const todayIso = new Date().toISOString().slice(0, 10)
  const todaysCollected = recentPayments
    .filter((p: any) => p.paidAt?.slice(0, 10) === todayIso)
    .reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0)

  // Pie data
  const pieData = [
    { name: 'Paid',    value: currentMonth.paid,    color: '#10b981' },
    { name: 'Pending', value: currentMonth.pending, color: '#f59e0b' },
    { name: 'Overdue', value: currentMonth.overdue, color: '#ef4444' },
  ]

  // Monthly collection bar
  const monthlyBarData = (() => {
    const map: Record<string, number> = {}
    recentPayments.forEach((p: any) => {
      const month = p.billingMonth
        ?? (p.paidAt ? new Date(p.paidAt).toLocaleString(undefined, { month: 'short', year: 'numeric' }) : 'Unknown')
      map[month] = (map[month] || 0) + Number(p.totalAmount || 0)
    })
    return Object.keys(map)
      .map(k => ({ month: k, amount: map[k] }))
      .sort((a, b) => a.month.localeCompare(b.month))
  })()

  // Payment modes
  const modeCounts: Record<string, number> = {}
  recentPayments.forEach((p: any) => {
    const m = (p.mode || p.paymentMode || 'ONLINE').toUpperCase()
    modeCounts[m] = (modeCounts[m] || 0) + 1
  })
  const modeTotal = Object.values(modeCounts).reduce((s, n) => s + n, 0) || 1

  // Resident health
  const owners   = Math.max(0, Math.round(residents.total * 0.25))
  const tenants  = Math.max(0, Math.round(residents.total * 0.60))
  const pending  = Math.max(0, residents.total - owners - tenants)
  const vehicles = Math.max(0, Math.round(residents.total * 0.17))

  return (
    <div className="space-y-5">

      {/* ── KPI cards ── */}
      <div className="grid-kpi">
        <StatCard
          icon={TrendingUp}
          label="Total Collection"
          value={`₹${Number(currentMonth.collected || 0).toLocaleString()}`}
          sub={`${currentMonth.billingMonth} total`}
          variant="brand"
          delay="fade-up-1"
          trendLabel="↑ 12% vs last year"
        />
        <StatCard
          icon={Wallet}
          label="Available Balance"
          value={`₹${Number(fund.balance || 0).toLocaleString()}`}
          sub="Surplus"
          variant="emerald"
          delay="fade-up-2"
          trendLabel="Surplus"
          trendColor="emerald"
        />
        <StatCard
          icon={Building2}
          label="This Month"
          value={`₹${Number(currentMonth.collected || 0).toLocaleString()}`}
          sub={currentMonth.billingMonth}
          variant="violet"
          delay="fade-up-3"
          trendLabel="Ongoing"
          trendColor="violet"
        />
        <StatCard
          icon={Users}
          label="Today"
          value={`₹${todaysCollected.toLocaleString()}`}
          sub="Today's collections"
          variant="amber"
          delay="fade-up-4"
          trendLabel="Today"
          trendColor="amber"
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="grid-kpi fade-up fade-up-2">
        <div className="action-card payments">
          <div className="action-icon"><CreditCard size={18} /></div>
          <p className="action-title">Add or edit payments</p>
          <p className="action-desc">Payment register &amp; month-wise entries</p>
        </div>
        <div className="action-card ledger">
          <div className="action-icon"><BookOpen size={18} /></div>
          <p className="action-title">Fund Ledger</p>
          <p className="action-desc">Society income &amp; expense register</p>
        </div>
        <div className="action-card residents">
          <div className="action-icon"><Users size={18} /></div>
          <p className="action-title">Manage residents</p>
          <p className="action-desc">Owner, tenant, vehicle &amp; occupancy</p>
        </div>
        <div className="action-card emergency">
          <div className="action-icon"><AlertCircle size={18} /></div>
          <p className="action-title">Emergency</p>
          <p className="action-desc">Vendors, guards &amp; services</p>
        </div>
      </div>

      {/* ── Collection status + Top defaulters ── */}
      <div className="grid-2">
        {/* Pie chart */}
        <div className="card fade-up fade-up-1">
          <CardTitle sub={currentMonth.billingMonth}>This Month</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={35} outerRadius={54} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#fff', border: '1px solid var(--slate-200)',
                    borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: CheckCircle2, label: 'Paid',    val: currentMonth.paid,    color: '#10b981' },
                { icon: Clock,        label: 'Pending', val: currentMonth.pending, color: '#f59e0b' },
                { icon: AlertTriangle,label: 'Overdue', val: currentMonth.overdue, color: '#ef4444' },
              ].map(({ icon: Icon, label, val, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                    <Icon size={14} style={{ color }} /> {label}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top defaulters */}
        <div className="card fade-up fade-up-2">
          <CardTitle>Top Defaulters</CardTitle>
          {topDefaulters.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No defaulters 🎉</p>
          ) : (
            topDefaulters.slice(0, 5).map((d: any, i: number) => (
              <div key={i} className="defaulter-row">
                <div>
                  <p className="defaulter-flat">
                    {d.block} — {d.flatNumber}
                    <span className="overdue-badge">{d.unpaidMonths}m</span>
                  </p>
                  <p className="defaulter-sub">{d.unpaidMonths} months unpaid</p>
                </div>
                <span className="defaulter-amount">₹{Number(d.totalDue).toLocaleString()}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Monthly trend + side widgets ── */}
      <div className="grid-2-1">
        {/* Bar chart */}
        <div className="chart-card fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="section-label">Monthly Collection Trend</p>
            <span className="live-badge"><span className="live-dot" /> LIVE</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            ₹{Number(currentMonth.collected || 0).toLocaleString()} · {recentPayments.length} payments
          </p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBarData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#60a5fa" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--slate-100)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => `₹${Number(v).toLocaleString()}`}
                  contentStyle={{
                    background: '#fff', border: '1px solid var(--slate-200)',
                    borderRadius: 10, fontSize: 12, boxShadow: 'var(--shadow)',
                  }}
                />
                <Bar dataKey="amount" fill="url(#gradBlue)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Payment modes */}
          <div className="card fade-up fade-up-1">
            <CardTitle sub="Online vs cash">Payment Modes</CardTitle>
            {Object.keys(modeCounts).map(k => (
              <div key={k} className="mode-bar-row">
                <span className="mode-bar-label">{k}</span>
                <div className="mode-bar-track">
                  <div
                    className={`mode-bar-fill ${k === 'CASH' ? 'cash' : 'online'}`}
                    style={{ width: `${Math.round((modeCounts[k] / modeTotal) * 100)}%` }}
                  />
                </div>
                <span className="mode-bar-pct">{Math.round((modeCounts[k] / modeTotal) * 100)}%</span>
              </div>
            ))}
          </div>

          {/* Resident health */}
          <div className="card fade-up fade-up-2">
            <CardTitle sub="Occupancy & profiles">Resident Health</CardTitle>
            <div className="health-grid">
              <div className="health-tile owner">
                <p className="health-tile-label">Owner</p>
                <p className="health-tile-value">{owners}</p>
              </div>
              <div className="health-tile tenant">
                <p className="health-tile-label">Tenant</p>
                <p className="health-tile-value">{tenants}</p>
              </div>
              <div className="health-tile pending">
                <p className="health-tile-label">Pending</p>
                <p className="health-tile-value">{pending}</p>
              </div>
              <div className="health-tile vehicles">
                <p className="health-tile-label">Vehicles</p>
                <p className="health-tile-value">{vehicles}</p>
              </div>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '82%' }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>82% profiles complete · 44 vehicles</p>
          </div>

          {/* Recently updated */}
          <div className="card fade-up fade-up-3">
            <CardTitle sub="Latest directory rows">Recently Updated</CardTitle>
            {recentPayments.slice(0, 5).map((p: any) => (
              <div key={p.id} className="updated-row">
                <span className="updated-dot" />
                <div>
                  <p className="updated-flat">{p.flat?.block?.name} / Flat {p.flat?.flatNumber}</p>
                  <p className="updated-sub">{p.payerName ?? p.paidBy ?? ''}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent payments ── */}
      <div className="card fade-up">
        <CardTitle sub="Latest entries">Recent Payments</CardTitle>
        {recentPayments.slice(0, 8).map((p: any) => (
          <div key={p.id} className="payment-row">
            <div>
              <p className="payment-flat">{p.flat?.block?.name} · Flat {p.flat?.flatNumber}</p>
              <p className="payment-date">
                {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusBadge status={(p.mode || p.paymentMode || 'ONLINE').toUpperCase() === 'CASH' ? 'PENDING' : 'PAID'} />
              <span className="payment-amount">₹{Number(p.totalAmount || 0).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}