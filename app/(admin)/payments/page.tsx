'use client'
// app/(admin)/payments/page.tsx
import { useEffect, useState } from 'react'
import { api, Payment } from '@/lib/api'
import { CreditCard, RefreshCw, Search, Filter, CheckCircle2, X, Zap } from 'lucide-react'
import clsx from 'clsx'

const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

function getCurrentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function generateRecentMonths(count = 12) {
  const res: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return res
}

function formatMonthLabel(ym: string) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const mi = Number(m) - 1
  const mon = monthNames[mi] ?? m
  return `${mon}-${y}`
}

const STATUS_TABS = ['ALL','PAID','PENDING','OVERDUE']

function Badge({ status }: { status: string }) {
  const cls = status === 'PAID' ? 'badge-paid' : status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending'
  return <span className={`badge ${cls}`}>{status}</span>
}

export default function PaymentsPage() {
  const [payments, setPayments]   = useState<Payment[]>([])
  const [month, setMonth]         = useState(getCurrentMonth())
  const [tab, setTab]             = useState('ALL')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [summary, setSummary]     = useState<any>(null)
  const [recording, setRecording] = useState<Payment | null>(null)
  const [mode, setMode]           = useState('CASH')
  const [lateFee, setLateFee]     = useState(0)
  const [saving, setSaving]       = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const params = `?billingMonth=${month}${tab !== 'ALL' ? `&status=${tab}` : ''}`
      const [p, s] = await Promise.all([api.getPayments(params), api.getSummary(month)])
      setPayments(p); setSummary(s)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [month, tab])

  const filtered = payments.filter(p =>
    p.flat?.flatNumber?.includes(search) ||
    p.flat?.block?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.flat?.ownerships?.[0]?.person?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleRecord = async () => {
    if (!recording) return
    setSaving(true)
    try {
      await api.recordPayment(recording.id, { mode, lateFee })
      setRecording(null)
      load()
    } finally { setSaving(false) }
  }

  const handleGenerate = async () => {
    if (!confirm(`Generate bills for ${month}?`)) return
    await api.generateBills(month)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between fade-up">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-slate-500 text-sm mt-0.5">Guard fund collection</p>
        </div>
        <button onClick={handleGenerate} className="btn-primary flex items-center gap-2">
          <Zap size={15} /> Generate Bills
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 fade-up fade-up-1">
          {[
            { label: 'Collection Rate', val: `${summary.collectionRate}%`, cls: 'text-emerald-400' },
            { label: 'Collected',       val: `₹${Number(summary.collected).toLocaleString()}`, cls: 'text-slate-900' },
            { label: 'Pending',         val: summary.pending, cls: 'text-amber-400' },
            { label: 'Overdue',         val: summary.overdue, cls: 'text-red-400' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="card">
              <p className="section-label mb-1">{label}</p>
              <p className={`font-display text-2xl font-bold ${cls}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 fade-up fade-up-2">
        <select
          className="input w-auto"
          value={month}
          onChange={e => setMonth(e.target.value)}
        >
          {generateRecentMonths(12).map(m => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
        </select>

        <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1">
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
                className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                tab === t ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-900'
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-8 text-xs" placeholder="Search flat/owner…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-500">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="card fade-up overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-surface-border">
                <th className="text-left px-5 pb-3">Flat</th>
                <th className="text-left px-3 pb-3">Payment</th>
                <th className="text-left px-3 pb-3 hidden sm:table-cell">Owner</th>
                <th className="text-left px-3 pb-3">Status</th>
                <th className="text-right px-3 pb-3">Amount</th>
                <th className="px-5 pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {p.flat?.block?.name?.replace('BLOCK-','B')} · {p.flat?.flatNumber}
                  </td>
                  <td className="px-3 py-3">{formatMonthLabel(p.billingMonth)}</td>
                  <td className="px-3 py-3 text-slate-400 hidden sm:table-cell text-xs">
                    {p.flat?.ownerships?.[0]?.person?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3"><Badge status={p.status} /></td>
                  <td className="px-3 py-3 text-right text-slate-900">
                    ₹{Number(p.totalAmount).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.status !== 'PAID' && (
                      <button
                        onClick={() => setRecording(p)}
                        className="btn-ghost text-xs flex items-center gap-1 ml-auto"
                      >
                        <CheckCircle2 size={13} /> Record
                      </button>
                    )}
                    {p.status === 'PAID' && p.receipt && (
                      <span className="text-xs text-slate-500">{p.receipt.receiptNumber}</span>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 text-sm">
                    No payments found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Record payment modal */}
      {recording && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={() => setRecording(null)} />
          <div className="relative w-full max-w-sm bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Record Payment</h2>
              <button onClick={() => setRecording(null)} className="text-slate-500 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>

            <div className="card bg-surface">
              <p className="text-slate-900 font-semibold">
                {recording.flat?.block?.name} · {recording.flat?.flatNumber}
              </p>
              <p className="text-slate-500 text-sm">{formatMonthLabel(recording.billingMonth)}</p>
              <p className="text-brand-400 font-bold text-lg mt-1">
                ₹{Number(recording.totalAmount).toLocaleString()}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="section-label mb-2">Payment Mode</p>
                <div className="grid grid-cols-3 gap-2">
                      {['CASH','UPI','ONLINE'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={clsx(
                        'py-2 rounded-xl text-xs font-semibold border transition-colors',
                        mode === m
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-gray-200 text-slate-600 hover:text-slate-900 hover:bg-gray-50'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="section-label mb-2">Late Fee (₹)</p>
                <input
                  type="number" className="input" placeholder="0"
                  value={lateFee} onChange={e => setLateFee(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setRecording(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleRecord} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Confirm ₹' + (Number(recording.totalAmount) + lateFee).toLocaleString()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
