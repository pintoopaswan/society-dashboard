'use client'
// app/(admin)/flats/page.tsx
import { useEffect, useState } from 'react'
import { api, Block, Flat, Payment } from '@/lib/api'
import { Building2, RefreshCw, Search, History, ChevronRight, X, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'

const STATUS_COLORS: Record<string, string> = {
  VACANT:         'bg-slate-600/40 text-slate-400 border-slate-600',
  OWNER_OCCUPIED: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  RENTED:         'bg-blue-500/20 text-blue-300 border-blue-500/40',
  LOCKED:         'bg-red-500/20 text-red-300 border-red-500/40',
}

const STATUS_LABEL: Record<string, string> = {
  VACANT:         'Vacant',
  OWNER_OCCUPIED: 'Owner',
  RENTED:         'Rented',
  LOCKED:         'Locked',
}

function PaymentBadge({ status }: { status: string }) {
  const cls =
    status === 'PAID'    ? 'badge-paid' :
    status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending'
  return <span className={`badge ${cls}`}>{status}</span>
}

type DrawerMode = 'detail' | 'history'

export default function FlatsPage() {
  const [blocks, setBlocks]         = useState<Block[]>([])
  const [flats, setFlats]           = useState<Flat[]>([])
  const [selected, setSelected]     = useState<Block | null>(null)
  const [blockFlats, setBlockFlats] = useState<Flat[]>([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)

  // Drawer state
  const [drawer, setDrawer]         = useState<Flat | null>(null)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('detail')
  const [history, setHistory]       = useState<Payment[]>([])
  const [histLoading, setHistLoading] = useState(false)

  // Record payment from history
  const [recording, setRecording]   = useState<Payment | null>(null)
  const [mode, setMode]             = useState('CASH')
  const [lateFee, setLateFee]       = useState(0)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    Promise.all([api.getBlocks(), api.getFlats()]).then(([b, f]) => {
      setBlocks(b); setFlats(f); setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selected) { setBlockFlats([]); return }
    setBlockFlats(flats.filter(f => f.blockId === selected.id))
  }, [selected, flats])

  const filtered = blockFlats.filter(f =>
    f.flatNumber.includes(search) ||
    f.ownerships?.[0]?.person?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const openDrawer = (f: Flat) => {
    setDrawer(f)
    setDrawerMode('detail')
    setHistory([])
  }

  const loadHistory = async (flatId: string) => {
    setHistLoading(true)
    setDrawerMode('history')
    try {
      const payments = await api.getPayments(`?flatId=${flatId}`)
      setHistory(payments.sort((a, b) => b.billingMonth.localeCompare(a.billingMonth)))
    } finally {
      setHistLoading(false)
    }
  }

  const handleRecord = async () => {
    if (!recording) return
    setSaving(true)
    try {
      await api.recordPayment(recording.id, { mode, lateFee })
      setRecording(null)
      setLateFee(0)
      if (drawer) loadHistory(drawer.id)
    } finally { setSaving(false) }
  }

  // Stats for history
  const paid    = history.filter(p => p.status === 'PAID').length
  const pending = history.filter(p => p.status === 'PENDING').length
  const overdue = history.filter(p => p.status === 'OVERDUE').length
  const totalDue = history
    .filter(p => p.status !== 'PAID')
    .reduce((s, p) => s + Number(p.totalAmount), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      <RefreshCw size={24} className="animate-spin mr-3" /> Loading…
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="fade-up">
        <h1 className="page-title">Flats</h1>
        <p className="text-slate-500 text-sm mt-0.5">{flats.length} total units across {blocks.length} blocks</p>
      </div>

      {/* Block selector */}
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2 fade-up fade-up-1">
        {blocks.map(b => (
          <button
            key={b.id}
            onClick={() => setSelected(selected?.id === b.id ? null : b)}
            className={clsx(
              'card text-center py-3 transition-all cursor-pointer',
              selected?.id === b.id ? 'border-brand-500 bg-brand-500/10' : 'hover:border-slate-500'
            )}
          >
            <Building2 size={16} className="mx-auto mb-1 text-slate-400" />
             <p className="text-xs font-semibold text-slate-700">{b.name.replace('BLOCK-', 'B')}</p>
            <p className="text-xs text-slate-500">{b.vacant}v</p>
          </button>
        ))}
      </div>

      {/* Flat grid */}
      {selected && (
        <div className="card fade-up">
          <div className="flex items-center justify-between mb-4 gap-3">
            <p className="font-display font-bold text-slate-900">{selected.name}</p>
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input pl-8" placeholder="Flat no. or owner…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${STATUS_COLORS[k]}`} />
                <span className="text-xs text-slate-500">{v}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {filtered.map(f => (
              <button
                key={f.id}
                onClick={() => openDrawer(f)}
                className={clsx(
                  'border rounded-xl p-2 text-center transition-all hover:scale-105 cursor-pointer',
                  STATUS_COLORS[f.status]
                )}
              >
                <p className="text-xs font-bold">{f.flatNumber}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {!selected && (
        <div className="card text-center py-12 text-slate-500 fade-up fade-up-2">
          <Building2 size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a block above to view its flats</p>
        </div>
      )}

      {/* Flat detail / history drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={() => setDrawer(null)} />
          <div className="relative w-full max-w-sm bg-surface-card border-l border-surface-border h-full overflow-y-auto flex flex-col">

            {/* Drawer header */}
            <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between sticky top-0 bg-surface-card z-10">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {selected?.name} · {drawer.flatNumber}
                </h2>
                <span className={`badge mt-1 ${
                  drawer.status === 'OWNER_OCCUPIED' ? 'badge-owner' :
                  drawer.status === 'RENTED'         ? 'badge-rented' : 'badge-vacant'
                }`}>
                  {STATUS_LABEL[drawer.status]}
                </span>
              </div>
              <button onClick={() => setDrawer(null)} className="text-slate-500 hover:text-slate-900">
                <X size={20} />
              </button>
            </div>

            {/* Tab switcher */}
            <div className="flex border-b border-surface-border">
              {(['detail', 'history'] as DrawerMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => m === 'history' ? loadHistory(drawer.id) : setDrawerMode('detail')}
                  className={clsx(
                    'flex-1 py-3 text-sm font-semibold transition-colors capitalize flex items-center justify-center gap-2',
                    drawerMode === m
                      ? 'text-brand-400 border-b-2 border-brand-500'
                      : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  {m === 'history' && <History size={14} />}
                  {m === 'detail' ? 'Details' : 'Payment History'}
                </button>
              ))}
            </div>

            {/* Detail tab */}
            {drawerMode === 'detail' && (
              <div className="p-6 space-y-3">
                <div className="card">
                  <p className="section-label mb-1">Floor</p>
                  <p className="text-slate-700">{drawer.floor}</p>
                </div>
                <div className="card">
                  <p className="section-label mb-1">Monthly Maintenance</p>
                  <p className="text-slate-900 font-semibold">₹{Number(drawer.monthlyMaintenance).toLocaleString()}</p>
                </div>
                {drawer.ownerships && drawer.ownerships[0] && (
                  <div className="card">
                    <p className="section-label mb-1">Owner</p>
                      <p className="text-slate-900 font-medium">{drawer.ownerships[0].person.name}</p>
                    <p className="text-slate-500 text-sm">{drawer.ownerships[0].person.phone}</p>
                  </div>
                )}
                {drawer.tenancies && drawer.tenancies[0] && (
                  <div className="card">
                    <p className="section-label mb-1">Tenant</p>
                      <p className="text-slate-900 font-medium">{drawer.tenancies[0].person.name}</p>
                    <p className="text-slate-500 text-sm">{drawer.tenancies[0].person.phone}</p>
                  </div>
                )}
                <button
                  onClick={() => loadHistory(drawer.id)}
                  className="w-full btn-primary flex items-center justify-center gap-2 mt-2"
                >
                  <History size={15} /> View Payment History
                </button>
              </div>
            )}

            {/* History tab */}
            {drawerMode === 'history' && (
              <div className="flex-1 flex flex-col">
                {histLoading ? (
                  <div className="flex items-center justify-center h-40 text-slate-500">
                    <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
                  </div>
                ) : (
                  <>
                    {/* Summary bar */}
                    <div className="grid grid-cols-3 gap-2 p-4 border-b border-surface-border">
                      <div className="text-center">
                          <p className="text-emerald-600 font-bold text-lg">{paid}</p>
                        <p className="text-xs text-slate-500">Paid</p>
                      </div>
                      <div className="text-center">
                          <p className="text-amber-500 font-bold text-lg">{pending}</p>
                        <p className="text-xs text-slate-500">Pending</p>
                      </div>
                      <div className="text-center">
                          <p className="text-red-500 font-bold text-lg">{overdue}</p>
                        <p className="text-xs text-slate-500">Overdue</p>
                      </div>
                    </div>

                    {totalDue > 0 && (
                      <div className="mx-4 mt-3 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                        <p className="text-red-400 text-sm font-semibold">
                          Total Due: ₹{totalDue.toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Payment rows */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {history.map(p => (
                        <div key={p.id}
                          className="card flex items-center justify-between gap-3 py-3">
                          <div>
                              <p className="text-slate-900 font-semibold text-sm">{p.billingMonth}</p>
                            {p.paidAt && (
                              <p className="text-xs text-slate-500 mt-0.5">
                                Paid {new Date(p.paidAt).toLocaleDateString('en-IN')}
                              </p>
                            )}
                            {p.receipt && (
                              <p className="text-xs text-slate-600 mt-0.5">{p.receipt.receiptNumber}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-slate-900 text-sm font-semibold">
                                ₹{Number(p.totalAmount).toLocaleString()}
                              </p>
                              <PaymentBadge status={p.status} />
                            </div>
                            {p.status !== 'PAID' && (
                              <button
                                onClick={() => setRecording(p)}
                                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                                title="Record payment"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {history.length === 0 && (
                        <div className="text-center py-12 text-slate-500">
                          <History size={28} className="mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No payment records found</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Record payment modal */}
      {recording && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={() => setRecording(null)} />
          <div className="relative w-full max-w-sm bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Record Payment</h2>
              <button onClick={() => setRecording(null)} className="text-slate-400 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>

            <div className="card bg-surface">
              <p className="text-slate-900 font-semibold">{selected?.name} · {drawer?.flatNumber}</p>
              <p className="text-slate-500 text-sm">{recording.billingMonth}</p>
              <p className="text-brand-400 font-bold text-lg mt-1">
                ₹{Number(recording.totalAmount).toLocaleString()}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <p className="section-label mb-2">Payment Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  {['CASH','UPI','ONLINE'].map(m => (
                    <button key={m} onClick={() => setMode(m)}
                      className={clsx(
                        'py-2 rounded-xl text-xs font-semibold border transition-colors',
                        mode === m
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'border-surface-border text-slate-400 hover:text-slate-900'
                      )}
                    >{m}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-label mb-2">Late Fee (₹)</p>
                <input type="number" className="input" placeholder="0"
                  value={lateFee} onChange={e => setLateFee(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setRecording(null)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleRecord} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : `Confirm ₹${(Number(recording.totalAmount) + lateFee).toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}