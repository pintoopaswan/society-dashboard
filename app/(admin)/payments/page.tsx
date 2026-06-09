'use client'
// app/(admin)/payments/page.tsx
import { useEffect, useState } from 'react'
import { api, Payment } from '@/lib/api'
import { RefreshCw, Search, CheckCircle2, X, Zap } from 'lucide-react'
import clsx from 'clsx'

const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

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
  return `${MONTH_NAMES[Number(m) - 1] ?? m}-${y}`
}

const STATUS_TABS = ['ALL', 'PAID', 'PENDING', 'OVERDUE']

function Badge({ status }: { status: string }) {
  const cls =
    status === 'PAID'    ? 'badge badge-paid'    :
    status === 'OVERDUE' ? 'badge badge-overdue' :
                           'badge badge-pending'
  return <span className={cls}>{status}</span>
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
      const [p, s] = await Promise.all([
        api.getPayments(params),
        api.getSummary(month),
      ])
      setPayments(p)
      setSummary(s)
    } finally {
      setLoading(false)
    }
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
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!confirm(`Generate bills for ${formatMonthLabel(month)}?`)) return
    await api.generateBills(month)
    load()
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 className="page-title">Payments</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
            Guard fund collection · {formatMonthLabel(month)}
          </p>
        </div>
        <button onClick={handleGenerate} className="btn-primary">
          <Zap size={14} /> Generate Bills
        </button>
      </div>

      {/* ── Summary cards ── */}
      {summary && (
        <div className="grid-kpi fade-up fade-up-1">
          <div className="stat-card brand">
            <p className="stat-label">Collection Rate</p>
            <p className="stat-value" style={{ color: 'var(--emerald-600)' }}>{summary.collectionRate}%</p>
          </div>
          <div className="stat-card emerald">
            <p className="stat-label">Collected</p>
            <p className="stat-value">₹{Number(summary.collected).toLocaleString()}</p>
          </div>
          <div className="stat-card amber">
            <p className="stat-label">Pending</p>
            <p className="stat-value" style={{ color: 'var(--amber-500)' }}>{summary.pending}</p>
          </div>
          <div className="stat-card" style={{ '--accent': 'var(--red-500)' } as any}>
            <p className="stat-label">Overdue</p>
            <p className="stat-value" style={{ color: 'var(--red-500)' }}>{summary.overdue}</p>
          </div>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div
        className="card fade-up fade-up-2"
        style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 18px' }}
      >
        {/* Month select */}
        <select
          style={{
            height: 36, border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-sm)',
            padding: '0 10px', fontSize: 13, color: 'var(--slate-700)',
            background: '#fff', cursor: 'pointer', outline: 'none', minWidth: 130,
          }}
          value={month}
          onChange={e => setMonth(e.target.value)}
        >
          {generateRecentMonths(12).map(m => (
            <option key={m} value={m}>{formatMonthLabel(m)}</option>
          ))}
        </select>

        {/* Status tabs */}
        <div style={{
          display: 'flex', background: 'var(--slate-100)', borderRadius: 'var(--radius-sm)',
          padding: 3, gap: 2, flexShrink: 0,
        }}>
          {STATUS_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                height: 30, padding: '0 12px', border: 'none',
                borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? 'var(--brand-600)' : 'var(--slate-500)',
                boxShadow: tab === t ? '0 1px 3px rgba(15,23,42,.10)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search
            size={14}
            style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }}
          />
          <input
            style={{
              width: '100%', height: 36, border: '1px solid var(--slate-200)',
              borderRadius: 'var(--radius-sm)', padding: '0 10px 0 32px',
              fontSize: 13, color: 'var(--slate-700)', outline: 'none', background: '#fff',
            }}
            placeholder="Search flat or owner…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <button onClick={load} className="btn-ghost" style={{ marginLeft: 'auto', height: 36, padding: '0 14px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: 'var(--text-muted)', gap: 8 }}>
          <RefreshCw size={18} className="spinner" /> Loading…
        </div>
      ) : (
        <div className="card fade-up" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--slate-100)' }}>
                  {[
                    { label: 'Flat',    w: 130 },
                    { label: 'Month',   w: 100 },
                    { label: 'Owner',   w: 160, hide: true },
                    { label: 'Status',  w: 90  },
                    { label: 'Amount',  w: 90,  right: true },
                    { label: '',        w: 110, right: true },
                  ].map(({ label, w, right, hide }) => (
                    <th
                      key={label}
                      style={{
                        width: w, padding: '11px 14px',
                        textAlign: right ? 'right' : 'left',
                        fontSize: 10, fontWeight: 700, letterSpacing: '.07em',
                        textTransform: 'uppercase', color: 'var(--text-muted)',
                        whiteSpace: 'nowrap', background: '#fff',
                      }}
                      className={hide ? 'hide-mobile' : ''}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const blockName = (typeof p.flat?.block === 'string'
                    ? p.flat.block
                    : p.flat?.block?.name ?? ''
                  ).replace('BLOCK-', 'B-')

                  return (
                    <tr
                      key={p.id}
                      style={{ borderBottom: '1px solid var(--slate-50)', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--brand-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      {/* Flat */}
                      <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--slate-900)', whiteSpace: 'nowrap' }}>
                        {blockName} · {p.flat?.flatNumber}
                      </td>

                      {/* Month */}
                      <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatMonthLabel(p.billingMonth)}
                      </td>

                      {/* Owner — hidden on mobile */}
                      <td
                        className="hide-mobile"
                        style={{
                          padding: '11px 14px', color: 'var(--text-muted)',
                          fontSize: 12, maxWidth: 160,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {p.flat?.ownerships?.[0]?.person?.name ?? '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '11px 14px' }}>
                        <Badge status={p.status} />
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--slate-900)', whiteSpace: 'nowrap' }}>
                        ₹{Number(p.totalAmount).toLocaleString()}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {p.status !== 'PAID' ? (
                          <button
                            onClick={() => setRecording(p)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '5px 10px', borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--emerald-500)',
                              color: 'var(--emerald-600)', background: 'var(--emerald-50)',
                              fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            <CheckCircle2 size={12} /> Record
                          </button>
                        ) : p.receipt ? (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {p.receipt.receiptNumber}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                      No payments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Record payment modal ── */}
      {recording && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16, background: 'rgba(15,23,42,.40)',
          }}
          onClick={() => setRecording(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 'var(--radius-lg)', padding: 24,
              width: '100%', maxWidth: 360,
              boxShadow: 'var(--shadow-lg)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--slate-900)' }}>Record Payment</h2>
              <button
                onClick={() => setRecording(null)}
                style={{
                  width: 28, height: 28, border: 'none', background: 'var(--slate-100)',
                  borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Payment summary */}
            <div style={{
              background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)',
              padding: '12px 14px', marginBottom: 18,
              border: '1px solid var(--slate-100)',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--slate-900)' }}>
                {recording.flat?.block?.name} · {recording.flat?.flatNumber}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {formatMonthLabel(recording.billingMonth)}
              </p>
              <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-600)', marginTop: 6 }}>
                ₹{Number(recording.totalAmount).toLocaleString()}
              </p>
            </div>

            {/* Mode selector */}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              Payment Mode
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
              {['CASH', 'UPI', 'ONLINE'].map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '8px 0', borderRadius: 'var(--radius-sm)', textAlign: 'center',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: mode === m ? '1px solid var(--emerald-500)' : '1px solid var(--slate-200)',
                    background: mode === m ? 'var(--emerald-50)' : '#fff',
                    color: mode === m ? 'var(--emerald-600)' : 'var(--slate-600)',
                    transition: 'all .15s',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Late fee */}
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              Late Fee (₹)
            </p>
            <input
              type="number"
              placeholder="0"
              value={lateFee}
              onChange={e => setLateFee(Number(e.target.value))}
              style={{
                width: '100%', height: 38, border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-sm)', padding: '0 12px',
                fontSize: 13, color: 'var(--slate-700)', outline: 'none',
                marginBottom: 18,
              }}
            />

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                onClick={() => setRecording(null)}
                style={{
                  padding: '10px 0', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--slate-200)', background: '#fff',
                  fontSize: 13, fontWeight: 600, color: 'var(--slate-600)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecord}
                disabled={saving}
                style={{
                  padding: '10px 0', borderRadius: 'var(--radius-sm)', border: 'none',
                  background: 'linear-gradient(135deg,var(--brand-600),var(--violet-500))',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1,
                }}
              >
                {saving ? 'Saving…' : `Confirm ₹${(Number(recording.totalAmount) + lateFee).toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}