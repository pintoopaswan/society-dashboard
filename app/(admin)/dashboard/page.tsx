'use client'
// app/(admin)/dashboard/page.tsx
import { useEffect, useState } from 'react'
import { api, DashboardData } from '@/lib/api'
import {
  Building2, Users, TrendingUp, Wallet,
  AlertTriangle, CheckCircle2, Clock, RefreshCw
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-400', delay = '' }: any) {
  return (
    <div className={`card fade-up ${delay}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="section-label mb-2">{label}</p>
          <p className="font-display text-3xl font-bold text-slate-900">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-surface ${color} bg-opacity-10`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: any = {
    PAID:    'badge badge-paid',
    PENDING: 'badge badge-pending',
    OVERDUE: 'badge badge-overdue',
  }
  return <span className={map[status] ?? 'badge badge-vacant'}>{status}</span>
}

export default function DashboardPage() {
  const [data, setData]       = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const load = async () => {
    setLoading(true)
    try {
      setData(await api.getDashboard())
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      <RefreshCw size={24} className="animate-spin mr-3" /> Loading dashboard…
    </div>
  )

  if (error) return (
    <div className="card text-red-400 text-sm">⚠ {error}</div>
  )

  if (!data) return null

  const { flats, residents, currentMonth, fund, recentPayments, topDefaulters } = data

  const pieData = [
    { name: 'Paid',    value: currentMonth.paid,    color: '#10b981' },
    { name: 'Pending', value: currentMonth.pending, color: '#f59e0b' },
    { name: 'Overdue', value: currentMonth.overdue, color: '#ef4444' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between fade-up">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">{currentMonth.billingMonth}</p>
        </div>
        <button onClick={load} className="btn-ghost flex items-center gap-2">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Building2}   label="Total Flats"  value={flats.total}
          sub={`${flats.vacant} vacant`} delay="fade-up-1" />
        <StatCard icon={Users}       label="Residents"    value={residents.total}
          sub="active persons" color="text-violet-400" delay="fade-up-2" />
        <StatCard icon={TrendingUp}  label="Collection"   value={`${currentMonth.collectionRate}%`}
          sub={`₹${currentMonth.collected.toLocaleString()} collected`}
          color="text-emerald-400" delay="fade-up-3" />
        <StatCard icon={Wallet}      label="Fund Balance" value={`₹${Number(fund.balance).toLocaleString()}`}
          sub="running balance" color="text-amber-400" delay="fade-up-4" />
      </div>

      {/* Middle row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Collection pie */}
        <div className="card fade-up fade-up-1">
          <p className="section-label mb-4">This Month — {currentMonth.billingMonth}</p>
          <div className="flex items-center gap-6">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={pieData} dataKey="value" innerRadius={35} outerRadius={55} paddingAngle={3}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e6e9ef', borderRadius: 8 }}
                  labelStyle={{ color: '#0f172a' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-3 flex-1">
              {[
                { icon: CheckCircle2, label: 'Paid',    val: currentMonth.paid,    cls: 'text-emerald-400' },
                { icon: Clock,        label: 'Pending', val: currentMonth.pending, cls: 'text-amber-400' },
                { icon: AlertTriangle,label: 'Overdue', val: currentMonth.overdue, cls: 'text-red-400' },
              ].map(({ icon: Icon, label, val, cls }) => (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Icon size={14} className={cls} /> {label}
                  </div>
                  <span className={`font-semibold ${cls}`}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top defaulters */}
        <div className="card fade-up fade-up-2">
          <p className="section-label mb-4">Top Defaulters</p>
          {topDefaulters.length === 0
            ? <p className="text-slate-500 text-sm">No defaulters 🎉</p>
            : (
              <div className="space-y-2">
                {topDefaulters.slice(0, 5).map((d: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.block} — {d.flatNumber}</p>
                      <p className="text-xs text-slate-500">{d.unpaidMonths} months unpaid</p>
                    </div>
                    <span className="text-red-500 font-semibold text-sm">
                      ₹{Number(d.totalDue).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      </div>

      {/* Recent payments */}
      <div className="card fade-up">
        <p className="section-label mb-4">Recent Payments</p>
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-surface-border">
                <th className="text-left px-5 pb-3">Flat</th>
                <th className="text-left px-3 pb-3">Month</th>
                <th className="text-left px-3 pb-3">Status</th>
                <th className="text-right px-5 pb-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.slice(0, 8).map((p: any) => (
                <tr key={p.id} className="border-b border-surface-border/50 hover:bg-surface-border/20 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {p.flat?.block?.name} — {p.flat?.flatNumber}
                  </td>
                  <td className="px-3 py-3 text-slate-500">{p.billingMonth}</td>
                  <td className="px-3 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-5 py-3 text-right text-slate-900 font-semibold">
                    ₹{Number(p.totalAmount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
