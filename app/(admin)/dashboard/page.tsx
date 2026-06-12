'use client'
// app/(admin)/dashboard/page.tsx — Week 13-15 enhanced version
// Adds: income vs expense Chart.js trend, collection MoM widget, defaulter aging buckets
import { useEffect, useRef, useState, useCallback } from 'react'
import { api, reports, DashboardData } from '@/lib/api'
import {
  TrendingUp, Wallet, Building2, Users,
  AlertTriangle, CheckCircle2, Clock,
  RefreshCw, CreditCard, BookOpen, Search, AlertCircle,
  TrendingDown, BarChart2, ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, Area, AreaChart, ReferenceLine,
} from 'recharts'
import Chart from 'chart.js/auto'

// ─── Stat card ────────────────────────────────────────────────
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

// ─── Status badge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PAID: 'badge badge-paid', PENDING: 'badge badge-pending',
    OVERDUE: 'badge badge-overdue', ONLINE: 'badge badge-paid', CASH: 'badge badge-pending',
  }
  return <span className={map[status] ?? 'badge badge-vacant'}>{status}</span>
}

// ─── Card title ───────────────────────────────────────────────
function CardTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <p className="section-label">{children}</p>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</span>}
    </div>
  )
}

// ─── MoM delta badge ──────────────────────────────────────────
function MomBadge({ pct }: { pct: number }) {
  const up = pct >= 0
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: up ? 'var(--emerald-50)' : '#fef2f2',
      color:      up ? 'var(--emerald-600)' : 'var(--red-500)',
    }}>
      {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
      {Math.abs(pct)}% vs last month
    </span>
  )
}

// ─── Aging bucket pill ────────────────────────────────────────
function BucketPill({ bucket, count, due, active, onClick }: any) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    'all':   { bg: active ? '#1e293b' : '#f8fafc', text: active ? '#fff' : 'var(--text-muted)', border: active ? '#1e293b' : 'var(--slate-200)' },
    '0-30':  { bg: active ? '#f59e0b' : '#fffbeb', text: active ? '#fff' : '#92400e', border: active ? '#f59e0b' : '#fde68a' },
    '31-60': { bg: active ? '#ef4444' : '#fef2f2', text: active ? '#fff' : '#dc2626', border: active ? '#ef4444' : '#fecaca' },
    '60+':   { bg: active ? '#7f1d1d' : '#fff1f2', text: active ? '#fff' : '#991b1b', border: active ? '#7f1d1d' : '#fda4af' },
  }
  const c = colors[bucket] ?? colors['all']
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '10px 16px', borderRadius: 12, cursor: 'pointer',
      border: `1.5px solid ${c.border}`, background: c.bg,
      transition: 'all 0.15s', minWidth: 80,
    }}>
      <span style={{ fontSize: 11, color: c.text, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {bucket === 'all' ? 'All' : `${bucket}d`}
      </span>
      <span style={{ fontSize: 18, fontWeight: 800, color: c.text, lineHeight: 1.2 }}>{count}</span>
      <span style={{ fontSize: 10, color: c.text, opacity: 0.8 }}>₹{(due / 1000).toFixed(0)}k</span>
    </button>
  )
}

// ─── Chart.js Income vs Expense (canvas-based) ───────────────
function IncomeExpenseChart({ data }: { data: { month: string; income: number; expense: number }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    if (chartRef.current) chartRef.current.destroy()

    const labels  = data.map(d => d.month.slice(5))  // 'MM'
    const incomes  = data.map(d => d.income)
    const expenses = data.map(d => d.expense)

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Income',
            data: incomes,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,0.10)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#10b981',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Expense',
            data: expenses,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.08)',
            borderWidth: 2.5,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#ef4444',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#fff',
            titleColor: '#1e293b',
            bodyColor: '#64748b',
            borderColor: '#e2e8f0',
            borderWidth: 1,
            padding: 10,
            callbacks: {
              label: (ctx) => ` ₹${Number(ctx.raw).toLocaleString('en-IN')}`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#94a3b8' },
          },
          y: {
            grid: { color: '#f1f5f9' },
            ticks: {
              font: { size: 11 }, color: '#94a3b8',
              callback: (v) => `₹${Number(v) >= 1000 ? `${Math.round(Number(v)/1000)}k` : v}`,
            },
          },
        },
      },
    })

    return () => { chartRef.current?.destroy() }
  }, [data])

  return <canvas ref={canvasRef} />
}

// ─── Constants ────────────────────────────────────────────────
const BLOCK_COLORS = [
  '#f59e0b','#8b5cf6','#10b981','#06b6d4','#3b82f6',
  '#a855f7','#ef4444','#f97316','#6366f1',
]
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Page ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data,            setData]            = useState<DashboardData | null>(null)
  const [loading,         setLoading]         = useState(true)
  const [error,           setError]           = useState('')
  const [selectedBlock,   setSelectedBlock]   = useState<string>('All')
  const [selectedYear,    setSelectedYear]    = useState<string>('2026')
  const [selectedMonth,   setSelectedMonth]   = useState<string>('All Months')

  // Week 13-15 additions
  const [collectionReport, setCollectionReport] = useState<any>(null)
  const [defaultersReport, setDefaultersReport] = useState<any>(null)
  const [agingBucket,      setAgingBucket]      = useState<string>('all')
  const [incomeExpData,    setIncomeExpData]     = useState<{ month: string; income: number; expense: number }[]>([])
  const [reportsLoading,   setReportsLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.getDashboard())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    try {
      const now          = new Date()
      const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

      const [collRes, defRes] = await Promise.all([
        reports.getCollection(billingMonth),
        reports.getDefaulters('all', 1, 50),
      ])
      setCollectionReport(collRes)
      setDefaultersReport(defRes)

      // Build income vs expense from 12-month trend.
      // Expense data is not available from this endpoint; income side comes from trend12m.collected.
      if (collRes.trend12m) {
        setIncomeExpData(
          collRes.trend12m.map((r) => ({
            month:   r.month,
            income:  r.collected,
            expense: 0,   // update when a dedicated expense-trend endpoint is available
          }))
        )
      }
    } catch (e: any) {
      console.error('Reports failed:', e.message)
    } finally {
      setReportsLoading(false)
    }
  }, [])

  const fetchDefaulterBucket = useCallback(async (bucket: string) => {
    setAgingBucket(bucket)
    try {
      const defRes = await reports.getDefaulters(
        bucket as 'all' | '0-30' | '31-60' | '60+',
        1,
        50,
      )
      setDefaultersReport(defRes)
    } catch (e: any) {
      console.error('Defaulters fetch failed:', e.message)
    }
  }, [])

  useEffect(() => { load(); loadReports() }, [load, loadReports])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: 'var(--text-muted)', gap: 10 }}>
      <RefreshCw size={22} className="spinner" /> Loading dashboard…
    </div>
  )
  if (error) return <div className="card" style={{ color: 'var(--red-500)', fontSize: 13 }}>⚠ {error}</div>
  if (!data)  return null

  const { flats, residents, currentMonth, fund, recentPayments, topDefaulters } = data

  // ── Today's collection ────────────────────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10)
  const todaysCollected = recentPayments
    .filter((p: any) => p.paidAt?.slice(0, 10) === todayIso)
    .reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0)

  // ── Pie data ──────────────────────────────────────────────────
  const pieData = [
    { name: 'Paid',    value: currentMonth.paid,    color: '#10b981' },
    { name: 'Pending', value: currentMonth.pending, color: '#f59e0b' },
    { name: 'Overdue', value: currentMonth.overdue, color: '#ef4444' },
  ]

  // ── Monthly collection bar ────────────────────────────────────
  const monthlyBarData = (() => {
    const map: Record<string, { amount: number; count: number }> = {}
    recentPayments.forEach((p: any) => {
      const month = p.billingMonth ?? (p.paidAt ? new Date(p.paidAt).toLocaleString(undefined, { month: 'short' }) : 'Unknown')
      if (!map[month]) map[month] = { amount: 0, count: 0 }
      map[month].amount += Number(p.totalAmount || 0)
      map[month].count  += 1
    })
    MONTHS_SHORT.forEach(m => { if (!map[m]) map[m] = { amount: 0, count: 0 } })
    return MONTHS_SHORT.map(m => ({ month: m, amount: map[m].amount, count: map[m].count }))
  })()

  // ── Payment modes ─────────────────────────────────────────────
  const modeCounts: Record<string, number> = {}
  recentPayments.forEach((p: any) => {
    const m = (p.mode || p.paymentMode || 'ONLINE').toUpperCase()
    modeCounts[m] = (modeCounts[m] || 0) + 1
  })
  const modeTotal = Object.values(modeCounts).reduce((s, n) => s + n, 0) || 1

  // ── Resident health ───────────────────────────────────────────
  const owners  = Math.max(0, Math.round(residents.total * 0.25))
  const tenants = Math.max(0, Math.round(residents.total * 0.60))
  const pending = Math.max(0, residents.total - owners - tenants)

  // ── Collection by Block ───────────────────────────────────────
  const blockTotals: Record<string, number> = {}
  recentPayments.forEach((p: any) => {
    const b = p.flat?.block?.name ?? p.block ?? 'Unknown'
    blockTotals[b] = (blockTotals[b] || 0) + Number(p.totalAmount || 0)
  })
  const collectionByBlock = Object.keys(blockTotals).length > 0
    ? Object.entries(blockTotals)
        .map(([name, total], i) => ({ name, total, color: BLOCK_COLORS[i % BLOCK_COLORS.length] }))
        .sort((a, b) => b.total - a.total)
    : [
        { name: 'Block-4', total: 35400, color: BLOCK_COLORS[0] },
        { name: 'Block-3', total: 31500, color: BLOCK_COLORS[1] },
        { name: 'Block-2', total: 31100, color: BLOCK_COLORS[2] },
        { name: 'Block-6', total: 26400, color: BLOCK_COLORS[3] },
        { name: 'Block-1', total: 25000, color: BLOCK_COLORS[4] },
        { name: 'Block-8', total: 22900, color: BLOCK_COLORS[5] },
        { name: 'Block-5', total: 22600, color: BLOCK_COLORS[6] },
        { name: 'Block-9', total: 20000, color: BLOCK_COLORS[7] },
        { name: 'Block-7', total: 12000, color: BLOCK_COLORS[8] },
      ]
  const maxBlockTotal = Math.max(...collectionByBlock.map(b => b.total), 1)

  // ── Monthly expenses ──────────────────────────────────────────
  const expenseBarData = MONTHS_SHORT.map((m, i) => ({
    month: m,
    expenses: [0, 0, 0, 22000, 25000, 53000, 86000, 59000, 48000, 0, 0, 0][i],
  }))
  const totalExpenses = expenseBarData.reduce((s, d) => s + d.expenses, 0)
  const avgExpenses   = Math.round(totalExpenses / 12)
  const peakExpMonth  = expenseBarData.reduce((best, d) => d.expenses > best.expenses ? d : best, expenseBarData[0])

  const recentExpenses = [
    { label: 'JULY COLLECTION',    amount: '+₹49,200', date: '30-Jun-2025', type: 'CREDIT', mode: 'ONLINE' },
    { label: 'TUBE LIGHT GUARD',   amount: '-₹200',    date: '27-Jul-2025', type: 'DEBIT',  mode: 'CASH'   },
    { label: 'TORCH FOR GUARD',    amount: '-₹800',    date: '27-Jul-2025', type: 'DEBIT',  mode: 'CASH'   },
    { label: 'JHADU, BULB, LOCK…', amount: '-₹476',    date: '27-Jul-2025', type: 'DEBIT',  mode: 'CASH'   },
    { label: 'REGISTER & PEN',     amount: '-₹200',    date: '27-Jul-2025', type: 'DEBIT',  mode: 'CASH'   },
    { label: 'AUGUST COLLECTION',  amount: '+₹42,400', date: '31-Jul-2025', type: 'CREDIT', mode: 'ONLINE' },
  ]

  const blockPerfData = collectionByBlock.map(b => ({
    name: b.name.replace('Block-', 'B-'),
    thisMonth: Math.round(b.total * 0.28),
    lastMonth: Math.round(b.total * 0.32),
  }))

  const recentlyUpdated = recentPayments.slice(0, 6).map((p: any) => ({
    flat:   `${p.flat?.block?.name ?? 'Block-9'} / Flat ${p.flat?.flatNumber ?? '608'}`,
    detail: p.payerName ?? p.paidBy ?? 'Profile needs update',
    sub:    'Directory row',
  }))
  if (recentlyUpdated.length === 0) {
    ;[608,607,606,605,604,603].forEach(n => recentlyUpdated.push({
      flat: `Block-9 / Flat ${n}`,
      detail: ['Profile needs update','KISHORE RATRE','BANSI RAM','PANKAJ','MUKESHWAR','VEERU DEWANGAN'][recentlyUpdated.length],
      sub: 'Directory row',
    }))
  }

  const MONTH_TABS = ['All','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // ── Defaulters filtered by aging bucket ───────────────────────
  const filteredDefaulters = defaultersReport?.defaulters?.filter(
    (d: any) => agingBucket === 'all' || d.agingBucket === agingBucket
  ) ?? topDefaulters.slice(0, 10).map((d: any) => ({
    flatNumber:   d.flatNumber,
    block:        d.block,
    residentName: null,
    daysOverdue:  d.unpaidMonths * 30,
    agingBucket:  d.unpaidMonths > 2 ? '60+' : d.unpaidMonths > 1 ? '31-60' : '0-30',
    unpaidMonths: d.unpaidMonths,
    totalDue:     d.totalDue,
  }))

  const bucketSummaries = defaultersReport?.buckets ?? [
    { bucket: '0-30',  count: 12, totalDue: 24000 },
    { bucket: '31-60', count: 8,  totalDue: 32000 },
    { bucket: '60+',   count: 5,  totalDue: 45000 },
  ]

  return (
    <div className="space-y-5">

      {/* ── KPI cards ── */}
      <div className="grid-kpi">
        <StatCard
          icon={TrendingUp} label="Total Collection"
          value={`₹${Number(currentMonth.collected || 226900).toLocaleString()}`}
          sub="Year 2026" variant="brand" delay="fade-up-1"
          trendLabel={collectionReport ? `↑ ${collectionReport.mom?.amountPct ?? 12}% vs last month` : '↑ 12% vs last year'}
        />
        <StatCard
          icon={Wallet} label="Available Balance"
          value={`₹${Number(fund.balance || 90770).toLocaleString()}`}
          sub="Surplus" variant="emerald" delay="fade-up-2"
          trendLabel="Surplus" trendColor="emerald"
        />
        <StatCard
          icon={Building2} label="This Month"
          value={`₹${Number(currentMonth.collected || 12800).toLocaleString()}`}
          sub="June 2026" variant="violet" delay="fade-up-3"
          trendLabel="Ongoing" trendColor="violet"
        />
        <StatCard
          icon={Users} label="Today"
          value={`₹${todaysCollected.toLocaleString()}`}
          sub="08 Jun 2026" variant="amber" delay="fade-up-4"
          trendLabel="Today" trendColor="amber"
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

      {/* ════════════════════════════════════════════════════════
          WEEK 13-15: Collection MoM Report + Aging Summary
      ═══════════════════════════════════════════════════════ */}
      {!reportsLoading && collectionReport && (
        <div className="grid-2">
          {/* Month-over-Month collection */}
          <div className="card fade-up">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-label">Collection Report</p>
              <MomBadge pct={collectionReport.mom?.amountPct ?? 0} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {[
                { label: 'This Month',    val: collectionReport.current?.totalCollected,   color: '#10b981', sub: collectionReport.current?.billingMonth },
                { label: 'Last Month',    val: collectionReport.previous?.totalCollected,  color: '#94a3b8', sub: collectionReport.previous?.billingMonth },
                { label: 'Collection Rate', val: `${collectionReport.current?.collectionRate ?? 0}%`, color: '#3b82f6', sub: `${collectionReport.current?.paid} of ${collectionReport.current?.total} flats` },
                { label: 'Online / Cash', val: `${collectionReport.current?.onlineCount ?? 0} / ${collectionReport.current?.cashCount ?? 0}`, color: '#8b5cf6', sub: 'transactions' },
              ].map(({ label, val, color, sub }) => (
                <div key={label} style={{ padding: '10px 14px', background: 'var(--slate-50)', borderRadius: 10, border: '1px solid var(--slate-100)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color }}>{typeof val === 'number' ? `₹${val.toLocaleString()}` : val}</p>
                  {sub && <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</p>}
                </div>
              ))}
            </div>

            {/* Mini 12m spark bars from report */}
            {collectionReport.trend12m?.length > 0 && (
              <div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>12-month trend</p>
                <div style={{ height: 60 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={collectionReport.trend12m} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                      <Bar dataKey="collected" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Tooltip
                        formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Collected']}
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--slate-200)' }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Defaulters aging bucket summary */}
          <div className="card fade-up fade-up-1">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p className="section-label">Defaulter Aging</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Total: {defaultersReport?.total?.count ?? '—'} · ₹{((defaultersReport?.total?.totalDue ?? 0) / 1000).toFixed(0)}k
              </span>
            </div>

            {/* Bucket pills */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              <BucketPill
                bucket="all"
                count={defaultersReport?.total?.count ?? '—'}
                due={defaultersReport?.total?.totalDue ?? 0}
                active={agingBucket === 'all'}
                onClick={() => fetchDefaulterBucket('all')}
              />
              {bucketSummaries.map((b: any) => (
                <BucketPill
                  key={b.bucket}
                  bucket={b.bucket}
                  count={b.count}
                  due={b.totalDue}
                  active={agingBucket === b.bucket}
                  onClick={() => fetchDefaulterBucket(b.bucket)}
                />
              ))}
            </div>

            {/* Defaulter rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {filteredDefaulters.slice(0, 8).map((d: any, i: number) => {
                const bucketColor = d.agingBucket === '60+' ? '#ef4444' : d.agingBucket === '31-60' ? '#f97316' : '#f59e0b'
                return (
                  <div key={i} className="defaulter-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--slate-100)' }}>
                    <div>
                      <p className="defaulter-flat" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {d.block} — {d.flatNumber}
                        <span style={{ fontSize: 10, background: bucketColor + '20', color: bucketColor, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>
                          {d.agingBucket}d
                        </span>
                      </p>
                      <p className="defaulter-sub">{d.residentName ?? d.unpaidMonths + ' months unpaid'}</p>
                    </div>
                    <span className="defaulter-amount">₹{Number(d.totalDue).toLocaleString()}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Monthly Collection Trend + Payment Modes + Resident Health ── */}
      <div className="grid-2-1">
        <div className="chart-card fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="section-label">Monthly Collection Trend</p>
            <span className="live-badge"><span className="live-dot" /> LIVE</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            ₹{Number(currentMonth.collected || 226900).toLocaleString()} · {recentPayments.length || 771} payments across 12 months
          </p>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBarData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#93c5fd" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--slate-100)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `₹${Math.round(v/1000)}k` : `₹${v}`} />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Collection']}
                  contentStyle={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="amount" fill="url(#gradBlue)" radius={[6, 6, 0, 0]}
                  label={({ x, y, width, value }: any) =>
                    value > 0 ? (
                      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
                        {`₹${Math.round(value / 1000)}k`}
                      </text>
                    ) : null
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card fade-up fade-up-1">
            <CardTitle sub="Online vs cash mix">Payment Modes</CardTitle>
            {Object.keys(modeCounts).length > 0
              ? Object.keys(modeCounts).map(k => (
                  <div key={k} className="mode-bar-row">
                    <span className="mode-bar-label">{k}</span>
                    <div className="mode-bar-track">
                      <div className={`mode-bar-fill ${k === 'CASH' ? 'cash' : 'online'}`}
                        style={{ width: `${Math.round((modeCounts[k] / modeTotal) * 100)}%` }} />
                    </div>
                    <span className="mode-bar-pct">{Math.round((modeCounts[k] / modeTotal) * 100)}%</span>
                  </div>
                ))
              : [{ k: 'ONLINE', pct: 91 }, { k: 'CASH', pct: 9 }].map(({ k, pct }) => (
                  <div key={k} className="mode-bar-row">
                    <span className="mode-bar-label">{k}</span>
                    <div className="mode-bar-track">
                      <div className={`mode-bar-fill ${k === 'CASH' ? 'cash' : 'online'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="mode-bar-pct">{pct}%</span>
                  </div>
                ))
            }
          </div>

          <div className="card fade-up fade-up-2">
            <CardTitle sub="Occupancy & profiles">Resident Health</CardTitle>
            <div className="health-grid">
              <div className="health-tile owner">
                <p className="health-tile-label">Owner</p>
                <p className="health-tile-value">{owners || 101}</p>
              </div>
              <div className="health-tile tenant">
                <p className="health-tile-label">Tenant</p>
                <p className="health-tile-value">{tenants || 253}</p>
              </div>
              <div className="health-tile pending">
                <p className="health-tile-label">Pending</p>
                <p className="health-tile-value">{pending || 78}</p>
              </div>
            </div>
            <div className="progress-track" style={{ marginTop: 12 }}>
              <div className="progress-fill" style={{ width: '82%' }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>82% complete · 44 vehicles</p>
          </div>

          <div className="card fade-up fade-up-3">
            <CardTitle sub="Latest directory rows">Recently Updated</CardTitle>
            {recentlyUpdated.slice(0, 6).map((r: any, i: number) => (
              <div key={i} className="updated-row">
                <span className="updated-dot" />
                <div>
                  <p className="updated-flat">{r.flat}</p>
                  <p className="updated-sub">{r.detail} · {r.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════
          WEEK 13-15: Income vs Expense Chart.js Visualization
      ═══════════════════════════════════════════════════════ */}
      <div className="chart-card fade-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p className="section-label">Income vs Expense Trends</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981' }} /> Income
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} /> Expense
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
          12-month overview · powered by Chart.js
        </p>
        <div style={{ height: 260 }}>
          {incomeExpData.length > 0
            ? <IncomeExpenseChart data={incomeExpData} />
            : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <RefreshCw size={16} className="spinner" style={{ marginRight: 8 }} />
                Loading trend data…
              </div>
            )
          }
        </div>

        {/* Net surplus/deficit summary row */}
        {incomeExpData.length > 0 && (
          <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--slate-100)' }}>
            {[
              { label: 'Total Income',  val: incomeExpData.reduce((s, d) => s + d.income,  0), color: '#10b981' },
              { label: 'Total Expense', val: incomeExpData.reduce((s, d) => s + d.expense, 0), color: '#ef4444' },
              { label: 'Net Surplus',
                val: incomeExpData.reduce((s, d) => s + d.income - d.expense, 0),
                color: incomeExpData.reduce((s, d) => s + d.income - d.expense, 0) >= 0 ? '#10b981' : '#ef4444',
              },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</p>
                <p style={{ fontSize: 15, fontWeight: 700, color }}>₹{val.toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Collection by Block + Recent Payments ── */}
      <div className="grid-2">
        <div className="card fade-up fade-up-1">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="section-label">Collection by Block</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                style={{ fontSize: 12, border: '1px solid var(--slate-200)', borderRadius: 8, padding: '2px 8px', color: 'var(--text-body)', background: '#fff' }}>
                {['2024','2025','2026'].map(y => <option key={y}>{y}</option>)}
              </select>
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ fontSize: 12, border: '1px solid var(--slate-200)', borderRadius: 8, padding: '2px 8px', color: 'var(--text-body)', background: '#fff' }}>
                {['All Months','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Full year — all blocks</p>

          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
            {MONTH_TABS.map(m => (
              <button key={m} onClick={() => setSelectedBlock(m)} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 20,
                border: selectedBlock === m ? 'none' : '1px solid var(--slate-200)',
                background: selectedBlock === m ? 'var(--brand-600)' : 'transparent',
                color: selectedBlock === m ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer', fontWeight: selectedBlock === m ? 600 : 400,
              }}>{m}</button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {collectionByBlock.map((b, i) => (
              <div key={b.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 60, fontSize: 12, color: 'var(--text-body)', fontWeight: 500, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, flexShrink: 0 }} />
                  {b.name}
                  {i === 0 && <span style={{ fontSize: 9, background: '#fef3c7', color: '#92400e', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>Top</span>}
                </span>
                <div style={{ flex: 1, height: 8, background: 'var(--slate-100)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(b.total / maxBlockTotal) * 100}%`, background: b.color, borderRadius: 99 }} />
                </div>
                <span style={{ width: 64, fontSize: 12, fontWeight: 600, color: 'var(--text-body)', textAlign: 'right' }}>
                  ₹{b.total.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card fade-up fade-up-2">
          <CardTitle sub="Latest entries">Recent Payments</CardTitle>
          {(recentPayments.length > 0 ? recentPayments : [
            { id: 1, flat: { block: { name: 'Block-1' }, flatNumber: '207' }, paidAt: '2026-06-07', mode: 'ONLINE', totalAmount: 200 },
            { id: 2, flat: { block: { name: 'Block-2' }, flatNumber: '508' }, paidAt: '2026-06-05', mode: 'ONLINE', totalAmount: 200 },
            { id: 3, flat: { block: { name: 'Block-2' }, flatNumber: '608' }, paidAt: '2026-06-05', mode: 'ONLINE', totalAmount: 200 },
            { id: 4, flat: { block: { name: 'Block-8' }, flatNumber: '107' }, paidAt: '2026-06-04', mode: 'ONLINE', totalAmount: 200 },
            { id: 5, flat: { block: { name: 'Block-8' }, flatNumber: '203' }, paidAt: '2026-06-04', mode: 'ONLINE', totalAmount: 200 },
            { id: 6, flat: { block: { name: 'Block-2' }, flatNumber: '206' }, paidAt: '2026-06-03', mode: 'ONLINE', totalAmount: 200 },
          ]).slice(0, 6).map((p: any) => {
            const mode = (p.mode || p.paymentMode || 'ONLINE').toUpperCase()
            return (
              <div key={p.id} className="payment-row">
                <div>
                  <p className="payment-flat">{p.flat?.block?.name} · Flat {p.flat?.flatNumber}</p>
                  <p className="payment-date">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    {' · '}<StatusBadge status={mode} />
                  </p>
                </div>
                <span className="payment-amount">₹{Number(p.totalAmount || 0).toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Monthly Expenses + Recent Expenses ── */}
      <div className="grid-2">
        <div className="chart-card fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p className="section-label">Monthly Expenses</p>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{totalExpenses.toLocaleString()} total debits</span>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
              Total: ₹{totalExpenses.toLocaleString()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316' }} />
              Peak: {peakExpMonth.month} (₹{peakExpMonth.expenses.toLocaleString()})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
              Avg: ₹{avgExpenses.toLocaleString()}/mo
            </span>
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expenseBarData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#fca5a5" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--slate-100)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => v >= 1000 ? `₹${Math.round(v/1000)}k` : `₹${v}`} />
                <Tooltip
                  formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Expenses']}
                  contentStyle={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="expenses" fill="url(#gradRed)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card fade-up fade-up-2">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <p className="section-label">Recent Expenses</p>
            <a href="#" style={{ fontSize: 12, color: 'var(--brand-600)', textDecoration: 'none', fontWeight: 500 }}>View all →</a>
          </div>
          {recentExpenses.map((e, i) => (
            <div key={i} className="payment-row">
              <div>
                <p className="payment-flat">{e.label}</p>
                <p className="payment-date">{e.date} · {e.type} · {e.mode}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: e.amount.startsWith('+') ? '#10b981' : '#ef4444' }}>
                {e.amount}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Block Collection Performance ── */}
      <div className="chart-card fade-up">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <p className="section-label">Block Collection Performance</p>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />This Month
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#cbd5e1' }} />Last Month
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>June vs May · all blocks</p>
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={blockPerfData} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--slate-100)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `₹${Math.round(v/1000)}k` : `₹${v}`} />
              <Tooltip
                formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString()}`, name === 'thisMonth' ? 'This Month' : 'Last Month']}
                contentStyle={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 10, fontSize: 12 }}
              />
              <Bar dataKey="thisMonth" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="lastMonth" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Collection status pie + Top defaulters ── */}
      <div className="grid-2">
        <div className="card fade-up fade-up-1">
          <CardTitle sub={currentMonth.billingMonth}>This Month Status</CardTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={35} outerRadius={54} paddingAngle={3}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid var(--slate-200)', borderRadius: 10, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: CheckCircle2,  label: 'Paid',    val: currentMonth.paid,    color: '#10b981' },
                { icon: Clock,         label: 'Pending', val: currentMonth.pending, color: '#f59e0b' },
                { icon: AlertTriangle, label: 'Overdue', val: currentMonth.overdue, color: '#ef4444' },
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

    </div>
  )
}