'use client'
// app/(admin)/payments/page.tsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { CreditCard, Home, Globe, Wallet, ChevronDown, Plus, Search, X, RefreshCw } from 'lucide-react'
import { api, type PaymentHistoryEntry } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMode = 'ONLINE' | 'CASH'

interface Payment {
  month: number        // 1–12
  amount: number
  date: string         // DD/MM/YYYY display format
  billingMonth: string // "2026-01"
  mode: PaymentMode
  notes: string | null
}

interface Flat {
  block: string
  flat: string
  payments: Payment[]
  loading: boolean
  error: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']

/** Derive payment mode from mode field or notes fallback */
function inferMode(mode: string | null, notes: string | null): PaymentMode {
  if (mode) {
    const m = mode.toUpperCase()
    if (m === 'CASH') return 'CASH'
    if (m === 'ONLINE' || m === 'UPI' || m === 'NEFT' || m === 'IMPS' || m === 'RTGS') return 'ONLINE'
  }
  if (notes) {
    const n = notes.toLowerCase()
    if (n.includes('cash')) return 'CASH'
  }
  return 'ONLINE'
}

/** Format ISO date string → DD/MM/YYYY */
function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Fetch all 2026 payment history in one call, then merge onto the canonical
 * FLAT_STRUCTURE so every flat appears — even those with no payments yet.
 */
/** Normalize any block string the API might return → "Block-N"
 *  Handles: "1", "block1", "Block 1", "Block-1", "BLOCK-1" etc.
 */
function normalizeBlock(raw: string): string {
  // Extract the numeric part from whatever format
  const match = raw.match(/\d+/)
  if (!match) return raw
  return `Block-${match[0]}`
}

/** Normalize flat numbers: strip leading zeros or block prefix the API might include.
 *  e.g. "101", "0101", "1-101" → "101"
 */
function normalizeFlat(raw: string): string {
  // Remove any non-digit prefix up to a hyphen, then parse as integer to strip leading zeros
  const stripped = raw.includes('-') ? raw.split('-').pop()! : raw
  return String(parseInt(stripped, 10))
}

async function fetchAllPayments(): Promise<Flat[]> {
  const entries: PaymentHistoryEntry[] = await api.getPaymentHistory({ year: '2026' })

  // Debug: log first few entries to verify API field values in browser console
  if (entries.length > 0) {
    console.log('[PaymentsPage] API sample entry:', entries[0])
    console.log('[PaymentsPage] Total entries:', entries.length)
    console.log('[PaymentsPage] Unique blocks:', [...new Set(entries.map(e => e.block))])
    console.log('[PaymentsPage] Sample flat numbers:', [...new Set(entries.map(e => e.flatNumber))].slice(0, 10))
  }

  // Build a payment-map: "Block-N__flatNumber" → Payment[]
  const map = new Map<string, Payment[]>()
  for (const entry of entries) {
    if (!entry.block || !entry.flatNumber || !entry.billingMonth) continue

    const block = normalizeBlock(entry.block)
    const flat  = normalizeFlat(entry.flatNumber)

    const [, monthStr] = entry.billingMonth.split('-')
    const monthNum = parseInt(monthStr, 10)
    if (!monthNum) continue

    const payment: Payment = {
      month: monthNum,
      amount: entry.amount,
      date: fmtDate(entry.date),
      billingMonth: entry.billingMonth,
      mode: inferMode(entry.mode, entry.notes),
      notes: entry.notes,
    }
    const key = `${block}__${flat}`
    const existing = map.get(key) ?? []
    existing.push(payment)
    map.set(key, existing)
  }

  // Merge onto canonical structure — every flat always present
  return FLAT_STRUCTURE.map(({ block, flat }) => ({
    block,
    flat,
    payments: map.get(`${block}__${flat}`) ?? [],
    loading: false,
    error: false,
  }))
}

// ─── Canonical flat structure: Block-1..9, floors 1..6, flats X01..X08 ──────────

const ALL_BLOCKS = ['Block-1','Block-2','Block-3','Block-4','Block-5','Block-6','Block-7','Block-8','Block-9']
const FLOORS = [1, 2, 3, 4, 5, 6]
const FLATS_PER_FLOOR = [1, 2, 3, 4, 5, 6, 7, 8]

/** Full canonical list: every flat that should appear in the table.
 *  Flat numbers: floor * 100 + unit → 101..108, 201..208, ... 601..608
 */
const FLAT_STRUCTURE: { block: string; flat: string }[] = ALL_BLOCKS.flatMap(block =>
  FLOORS.flatMap(floor =>
    FLATS_PER_FLOOR.map(unit => ({ block, flat: String(floor * 100 + unit) }))
  )
)

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, color, label, value, sub, pct, barColor, loading }: {
  icon: React.ReactNode; color: string; label: string; value: string
  sub: string; pct: number; barColor: string; loading?: boolean
}) {
  return (
    <div style={{
      flex: 1, minWidth: 0, background: '#fff', borderRadius: 16,
      border: '1px solid #e8edf3', padding: '22px 24px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: color, opacity: 0.06 }} />
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        {loading ? (
          <div style={{ marginTop: 6, height: 28, width: 100, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: barColor, background: barColor + '18', borderRadius: 20, padding: '2px 8px' }}>{pct}%</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</span>
      </div>
      <div style={{ height: 4, borderRadius: 4, background: barColor + '22', overflow: 'hidden', marginTop: 2 }}>
        <div style={{ height: '100%', width: loading ? '0%' : `${Math.min(pct, 100)}%`, borderRadius: 4, background: barColor, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  )
}

// ─── Payment Cell ─────────────────────────────────────────────────────────────

function PaymentCell({ payment, loading }: { payment?: Payment; loading?: boolean }) {
  if (loading) {
    return (
      <td style={{ padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 48, height: 14, borderRadius: 4, background: '#f1f5f9', margin: '0 auto', animation: 'pulse 1.5s ease-in-out infinite' }} />
      </td>
    )
  }
  if (!payment) {
    return (
      <td style={{ padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', background: '#fff1f2' }}>
        <span style={{ color: '#fca5a5', fontSize: 16, fontWeight: 700 }}>—</span>
      </td>
    )
  }
  const isOnline = payment.mode === 'ONLINE'
  const color = isOnline ? '#059669' : '#2563eb'
  return (
    <td style={{ padding: '6px 2px', textAlign: 'center', borderBottom: '1px solid #f1f5f9', background: '#f0fdf4', verticalAlign: 'top' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color, whiteSpace: 'nowrap' }}>₹{payment.amount.toLocaleString('en-IN')}</span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{payment.date}</span>
        <span style={{ fontSize: 9, fontWeight: 600, color, background: color + '18', borderRadius: 4, padding: '1px 5px', maxWidth: 72, textAlign: 'center', lineHeight: 1.5 }}>
          {MONTHS[payment.month - 1]}
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color, background: color + '14', borderRadius: 4, padding: '1px 5px' }}>{payment.mode}</span>
      </div>
    </td>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [flats, setFlats] = useState<Flat[]>([])
  const [globalLoading, setGlobalLoading] = useState(true)
  const [globalError, setGlobalError] = useState(false)
  const [blockFilter, setBlockFilter] = useState('All Blocks')
  const [fieldFilter, setFieldFilter] = useState('All Fields')
  const [search, setSearch] = useState('')
  const [showBlockDrop, setShowBlockDrop] = useState(false)
  const [showFieldDrop, setShowFieldDrop] = useState(false)

  // ── Single API call: fetch all 2026 payment history ──────────────────────

  const loadAll = useCallback(async () => {
    setGlobalLoading(true)
    setGlobalError(false)
    try {
      const result = await fetchAllPayments()
      setFlats(result)
    } catch {
      setGlobalError(true)
      setFlats([])
    } finally {
      setGlobalLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Derive block list dynamically from API data ───────────────────────────

  // Block list is always the canonical set (API data merged onto it)

  // ── Derived KPI values ────────────────────────────────────────────────────

  const allLoading = globalLoading
  const allPayments = flats.flatMap(f => f.payments)
  const totalCollection = allPayments.reduce((s, p) => s + p.amount, 0)
  const onlineCollection = allPayments.filter(p => p.mode === 'ONLINE').reduce((s, p) => s + p.amount, 0)
  const cashCollection = totalCollection - onlineCollection
  const paidFlats = flats.filter(f => f.payments.length > 0).length
  const totalFlats = FLAT_STRUCTURE.length

  const onlinePct = totalCollection ? Math.round((onlineCollection / totalCollection) * 100) : 0
  const cashPct   = totalCollection ? Math.round((cashCollection   / totalCollection) * 100) : 0
  const paidPct   = totalFlats > 0 ? Math.round((paidFlats / totalFlats) * 100) : 0
  const yearTarget = 1_030_000
  const collectedPct = Math.min(Math.round((totalCollection / yearTarget) * 100), 100)

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')

  // ── Month header stats (recomputed from live data) ────────────────────────

  const monthStats = useMemo(() => MONTHS.map((_, mi) => {
    const monthIdx = mi + 1
    let total = 0; let count = 0
    flats.forEach(f => {
      const p = f.payments.find(p => p.month === monthIdx)
      if (p) { total += p.amount; count++ }
    })
    return { total, flats: count }
  }), [flats])

  // ── Filtered rows ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => flats.filter(f => {
    if (blockFilter !== 'All Blocks' && f.block !== blockFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    if (f.block.toLowerCase().includes(q)) return true
    if (f.flat.toLowerCase().includes(q)) return true
    if (f.payments.some(p => String(p.amount).includes(q))) return true
    return false
  }), [flats, blockFilter, search])

  // ── Dropdown component ────────────────────────────────────────────────────

  const Dropdown = ({ value, options, open, setOpen, onChange }: {
    value: string; options: string[]; open: boolean
    setOpen: (v: boolean) => void; onChange: (v: string) => void
  }) => (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 40,
          borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff',
          fontSize: 13, fontWeight: 500, color: '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        {value} <ChevronDown size={14} color="#94a3b8" />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '110%', left: 0, zIndex: 20,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,0.1)', minWidth: 160, overflow: 'hidden',
          }}>
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                  fontSize: 13, cursor: 'pointer', border: 'none',
                  background: o === value ? 'rgba(124,58,237,0.06)' : '#fff',
                  color: o === value ? '#7c3aed' : '#0f172a',
                  fontWeight: o === value ? 600 : 400,
                }}
                onMouseEnter={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                onMouseLeave={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#fff' }}
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Skeleton pulse animation */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>


        {/* ── Error banner ── */}
        {globalError && (
          <div style={{
            padding: '14px 18px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca',
            color: '#b91c1c', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>Failed to load payment data. Check your connection and try again.</span>
            <button onClick={loadAll} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Retry
            </button>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <div style={{ display: 'flex', gap: 16, width: '100%' }}>
          <KpiCard icon={<CreditCard size={18} color="#3b82f6" />} color="#3b82f6" label="Total Collection"
            value={fmt(totalCollection)} sub={`${collectedPct}% collected · year 2026`} pct={collectedPct} barColor="#3b82f6" loading={allLoading} />
          <KpiCard icon={<Home size={18} color="#10b981" />} color="#10b981" label="Paid Flats"
            value={`${paidFlats} / ${totalFlats}`} sub={`${paidPct}% of flats paid`} pct={paidPct} barColor="#10b981" loading={allLoading} />
          <KpiCard icon={<Globe size={18} color="#8b5cf6" />} color="#8b5cf6" label="Online Collection"
            value={fmt(onlineCollection)} sub="of total collected" pct={onlinePct} barColor="#8b5cf6" loading={allLoading} />
          <KpiCard icon={<Wallet size={18} color="#f59e0b" />} color="#f59e0b" label="Cash Collection"
            value={fmt(cashCollection)} sub="of total collected" pct={cashPct} barColor="#f59e0b" loading={allLoading} />
        </div>

        {/* ── Filters bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <Dropdown value={blockFilter} open={showBlockDrop} setOpen={setShowBlockDrop}
            options={['All Blocks', ...ALL_BLOCKS]} onChange={setBlockFilter} />
          <Dropdown value={fieldFilter} open={showFieldDrop} setOpen={setShowFieldDrop}
            options={['All Fields', 'Amount', 'Date', 'Mode']} onChange={setFieldFilter} />

          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
              <Search size={14} color="#94a3b8" />
            </span>
            <input
              style={{
                display: 'block', width: '100%', boxSizing: 'border-box',
                height: 40, paddingLeft: 36, paddingRight: search ? 36 : 12,
                border: '1.5px solid #e2e8f0', borderRadius: 8,
                fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none',
              }}
              placeholder="Search block, flat, or amount..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#7c3aed')}
              onBlur={e => ((e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0')}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                width: 20, height: 20, borderRadius: 5, border: 'none',
                background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', padding: 0,
              }}>
                <X size={11} color="#64748b" />
              </button>
            )}
          </div>

          <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 500 }}>
            {totalFlats} flats
          </span>

          {/* Refresh button */}
          <button
            onClick={loadAll}
            title="Reload payment data"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: '#fff', cursor: 'pointer', color: '#64748b', flexShrink: 0,
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#f8fafc')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#fff')}
          >
            <RefreshCw size={15} className={allLoading ? 'animate-spin' : ''} />
          </button>

          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px', height: 40,
              borderRadius: 8, background: '#16a34a', border: 'none',
              fontSize: 13, fontWeight: 600, color: '#fff',
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#15803d')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#16a34a')}
          >
            <Plus size={15} /> Add Payment
          </button>
        </div>

        {/* ── Table ── */}
        <div style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div style={{ width: '100%' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: '#0f172a' }}>
                  <th style={{ padding: '10px 8px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', width: '7%' }}>Block</th>
                  <th style={{ padding: '10px 6px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', width: '4%' }}>Flat</th>
                  {MONTHS.map((m, i) => (
                    <th key={m} style={{ padding: '6px 2px', textAlign: 'center', background: '#0f172a', width: '6.5%' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.04em' }}>{m}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: monthStats[i].total > 0 ? '#34d399' : '#475569' }}>
                        {monthStats[i].total > 0 ? `₹${(monthStats[i].total / 1000).toFixed(1)}K` : '₹0'}
                      </div>
                      <div style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>
                        {monthStats[i].flats > 0 ? `${monthStats[i].flats}` : '0'}
                      </div>
                    </th>
                  ))}
                  <th style={{ padding: '10px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', width: '5%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = []
                  let lastBlock = ''
                  filtered.forEach((f, idx) => {
                    // ── Block separator header ──
                    if (f.block !== lastBlock) {
                      lastBlock = f.block
                      const blockFlats = filtered.filter(x => x.block === f.block)
                      const blockTotal = blockFlats.reduce((s, x) => s + x.payments.reduce((a, p) => a + p.amount, 0), 0)
                      const blockPaid  = blockFlats.filter(x => x.payments.length > 0).length
                      rows.push(
                        <tr key={`sep-${f.block}`} style={{ background: '#1e293b' }}>
                          <td colSpan={15} style={{ padding: '10px 16px', borderBottom: '2px solid #334155' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>{f.block}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', background: '#334155', borderRadius: 20, padding: '2px 10px' }}>
                                {blockFlats.length} flats
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399', background: '#064e3b', borderRadius: 20, padding: '2px 10px' }}>
                                {blockPaid} paid
                              </span>
                              {blockTotal > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginLeft: 'auto', marginRight: 4 }}>
                                  ₹{blockTotal.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    // ── Flat data row ──
                    const total = f.payments.reduce((s, p) => s + p.amount, 0)
                    rows.push(
                      <tr key={`${f.block}-${f.flat}`} style={{ background: '#fff' }}>
                        <td style={{ padding: '8px 8px', fontSize: 11, fontWeight: 500, color: '#64748b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.block}</td>
                        <td style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{f.flat}</td>
                        {MONTHS.map((_, mi) => {
                          const p = f.payments.find(p => p.month === mi + 1)
                          return <PaymentCell key={mi} payment={p} />
                        })}
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: total > 0 ? '#0f172a' : '#94a3b8', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                          {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                      </tr>
                    )
                  })
                  return rows
                })()}
                {globalLoading && (
                  Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={`skel-${idx}`} style={{ background: '#fff' }}>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 60, height: 13, borderRadius: 4, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                      <td style={{ padding: '12px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 36, height: 13, borderRadius: 4, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                      {MONTHS.map((_, mi) => (
                        <td key={mi} style={{ padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                          <div style={{ width: 48, height: 14, borderRadius: 4, background: '#f1f5f9', margin: '0 auto', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        </td>
                      ))}
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ width: 40, height: 14, borderRadius: 4, background: '#f1f5f9', marginLeft: 'auto', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      </td>
                    </tr>
                  ))
                )}
                {!globalLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={15} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8', fontSize: 14 }}>
                      {globalError ? 'Failed to load data. Please retry.' : 'No flats found matching your filters'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  )
}