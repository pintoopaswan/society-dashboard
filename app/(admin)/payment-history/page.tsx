'use client'
// app/(admin)/payments/page.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  CreditCard, Home, Globe, Wallet, ChevronDown, Plus, Search, X,
  RefreshCw, CheckCircle2, AlertCircle, Loader2,
  Edit2, Trash2, List, Calendar, Clock, ChevronRight, Receipt,
} from 'lucide-react'
import { api, type PaymentHistoryEntry, type RecordPaymentByFlatPayload, type EditPaymentPayload } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMode = 'ONLINE' | 'CASH'
type TabView = 'heatmap' | 'calendar' | 'recent'

interface Payment {
  id?: string
  transactionId?: string   // master PaymentTransaction.id — used for edit & delete
  month: number
  amount: number           // for ANCHOR rows: real totalAmount collected. for CLONE rows: 0 (never summed)
  transactionAmount: number // always the real totalAmount — safe to display in tooltips/UI for any row
  date: string
  billingMonth: string     // anchor billing month (primary / last in paidMonths)
  mode: PaymentMode
  notes: string | null
  lateFee?: number
  receiptNumber?: string
  transactionRef?: string
  paidMonths?: string[]    // all billing months this single transaction covers
  isAnchorMonth?: boolean  // true → real transaction row; false → heatmap-only clone
}

interface Flat {
  block: string
  flat: string
  payments: Payment[]
  loading: boolean
  error: boolean
}

interface AddPaymentModalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  prefillBlock?: string
  prefillFlat?: string
  existingPayments?: Payment[]
  editMode?: boolean
  editPaymentId?: string
  editPrefill?: {
    amount: number
    lateFee: number
    mode: PaymentMode
    paidAt: string
    notes: string
    billingMonth: string
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTHS       = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function normalizeBlock(raw: string): string {
  // API returns "BLOCK-1"; convert to title-case "Block-1" used in FLAT_STRUCTURE
  const match = raw.match(/\d+/)
  return match ? `Block-${match[0]}` : raw
}

function normalizeFlat(raw: string): string {
  const stripped = raw.includes('-') ? raw.split('-').pop()! : raw
  return String(parseInt(stripped, 10))
}

async function fetchAllPayments(): Promise<Flat[]> {
  const entries: PaymentHistoryEntry[] = await api.getPaymentHistory({ year: '2026' })

  // ── How the API works after the migration ────────────────────────────────────
  // The backend now creates ONE master PaymentTransaction per payment event.
  // Paying Apr + May ₹400 produces a single entry:
  //   { id: "txn-abc", transactionRef: "TXN-12345678", amount: 400,
  //     paidMonths: ["2026-04","2026-05"], billingMonth: "2026-05" }
  //
  // Each entry is the canonical record. We build:
  //   • ONE anchor Payment per entry (isAnchorMonth=true) — used for totals, edit, delete.
  //   • Lightweight heatmap clones for months 2..N (isAnchorMonth=false) so the
  //     heatmap/calendar `find(p => p.month === N)` resolves correctly for every month.
  //     Clones share the same transactionId and are excluded from sum calculations.

  const flatPayments = new Map<string, Payment[]>()

  for (const entry of entries) {
    if (!entry.block || !entry.flatNumber || !entry.billingMonth) continue

    const block   = normalizeBlock(entry.block)
    const flat    = normalizeFlat(entry.flatNumber)
    const flatKey = `${block}__${flat}`

    if (!flatPayments.has(flatKey)) flatPayments.set(flatKey, [])
    const payments = flatPayments.get(flatKey)!

    const coveredMonths: string[] = Array.isArray(entry.paidMonths) && entry.paidMonths.length
      ? entry.paidMonths
      : [entry.billingMonth]

    const anchorBm  = coveredMonths[0]
    const [, anchorMs] = anchorBm.split('-')
    const anchorNum = parseInt(anchorMs, 10)
    if (!anchorNum) continue

    // ── Anchor row: one per master transaction ───────────────────────────────
    payments.push({
      id:                entry.id,
      transactionId:     entry.id,
      month:             anchorNum,
      amount:            entry.amount,     // real total — included in sums
      transactionAmount: entry.amount,     // same for anchor
      date:              entry.date ? fmtDate(String(entry.date)) : '',
      billingMonth:      anchorBm,
      mode:              inferMode(entry.mode, entry.notes),
      notes:             entry.notes,
      lateFee:           entry.lateFee ?? 0,
      receiptNumber:     entry.receiptNumber ?? undefined,
      transactionRef:    entry.transactionRef ?? undefined,
      paidMonths:        coveredMonths,
      isAnchorMonth:     true,
    })

    // ── Heatmap clones for months 2..N ──────────────────────────────────────
    // Clones are display-only markers so the heatmap `find(p => p.month === N)`
    // resolves for every covered month. They carry amount=0 so that any code
    // path that accidentally sums without filtering isAnchorMonth still gets
    // the correct total — the ₹400 lives only on the anchor row.
    for (let i = 1; i < coveredMonths.length; i++) {
      const bm     = coveredMonths[i]
      const [, ms] = bm.split('-')
      const mn     = parseInt(ms, 10)
      if (!mn) continue
      payments.push({
        id:                entry.id,
        transactionId:     entry.id,
        month:             mn,
        amount:            0,              // ← zero: clones are status markers, not money
        transactionAmount: entry.amount,   // real total — safe for display/tooltips only
        date:              entry.date ? fmtDate(String(entry.date)) : '',
        billingMonth:      bm,
        mode:              inferMode(entry.mode, entry.notes),
        notes:             entry.notes,
        lateFee:           entry.lateFee ?? 0,
        receiptNumber:     entry.receiptNumber ?? undefined,
        transactionRef:    entry.transactionRef ?? undefined,
        paidMonths:        coveredMonths,
        isAnchorMonth:     false,          // excluded from totals and transactions tab
      })
    }
  }

  return FLAT_STRUCTURE.map(({ block, flat }) => ({
    block, flat,
    payments: flatPayments.get(`${block}__${flat}`) ?? [],
    loading: false, error: false,
  }))
}
// ─── Flat structure ───────────────────────────────────────────────────────────

const ALL_BLOCKS      = ['Block-1','Block-2','Block-3','Block-4','Block-5','Block-6','Block-7','Block-8','Block-9']
const FLOORS          = [1, 2, 3, 4, 5, 6]
const FLATS_PER_FLOOR = [1, 2, 3, 4, 5, 6, 7, 8]

const FLAT_STRUCTURE: { block: string; flat: string }[] = ALL_BLOCKS.flatMap(block =>
  FLOORS.flatMap(floor =>
    FLATS_PER_FLOOR.map(unit => ({ block, flat: String(floor * 100 + unit) }))
  )
)

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  height: 40, padding: '0 12px',
  border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none',
  fontFamily: 'inherit',
}
const lockedFieldStyle: React.CSSProperties = {
  height: 40, padding: '0 12px', display: 'flex', alignItems: 'center',
  border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, fontWeight: 700, color: '#0f172a', background: '#f8fafc',
}
const btnPrimaryStyle: React.CSSProperties = {
  height: 40, padding: '0 20px', borderRadius: 8, border: 'none',
  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', background: '#16a34a',
}
const btnSecondaryStyle: React.CSSProperties = {
  height: 40, padding: '0 16px', borderRadius: 8,
  border: '1.5px solid #e2e8f0', background: '#fff',
  fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer',
}
const btnDangerStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  height: 40, padding: '0 20px', borderRadius: 8, border: 'none',
  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', background: '#dc2626',
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t) }, [onDone])
  const ok = type === 'success'
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 20px', borderRadius: 12,
      background: ok ? '#f0fdf4' : '#fef2f2',
      border: `1.5px solid ${ok ? '#86efac' : '#fca5a5'}`,
      boxShadow: '0 8px 32px rgba(15,23,42,0.14)',
      maxWidth: 380, animation: 'slideInRight 0.25s ease',
    }}>
      {ok ? <CheckCircle2 size={18} color="#16a34a" /> : <AlertCircle size={18} color="#dc2626" />}
      <span style={{ fontSize: 13, fontWeight: 600, color: ok ? '#15803d' : '#b91c1c' }}>{message}</span>
      <button onClick={onDone} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
        <X size={14} color={ok ? '#86efac' : '#fca5a5'} />
      </button>
    </div>
  )
}

// ─── ModalField ───────────────────────────────────────────────────────────────

function ModalField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>{error}</span>}
    </div>
  )
}

// ─── ModalSelect ──────────────────────────────────────────────────────────────

function ModalSelect({ value, open, setOpen, options, onChange, placeholder, disabled, hasError }: {
  value: string; open: boolean; setOpen: (v: boolean) => void; options: string[]
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean; hasError?: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(!open)} disabled={disabled}
        style={{
          ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          color: options.includes(value) ? '#0f172a' : '#94a3b8',
          background: disabled ? '#f8fafc' : '#fff',
          borderColor: hasError ? '#fca5a5' : '#e2e8f0',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: options.includes(value) ? 600 : 400 }}>
          {options.includes(value) ? value : placeholder}
        </span>
        <ChevronDown size={14} color="#94a3b8" />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '105%', left: 0, right: 0, zIndex: 1101,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)', maxHeight: 200, overflowY: 'auto',
          }}>
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
                  fontSize: 13, cursor: 'pointer', border: 'none',
                  background: o === value ? 'rgba(22,163,74,0.06)' : '#fff',
                  color: o === value ? '#16a34a' : '#0f172a',
                  fontWeight: o === value ? 700 : 400,
                }}
                onMouseEnter={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                onMouseLeave={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#fff' }}
              >{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Add / Edit Payment Modal ─────────────────────────────────────────────────

function AddPaymentModal({
  open, onClose, onSuccess, prefillBlock, prefillFlat,
  existingPayments = [], editMode = false, editPaymentId, editPrefill,
}: AddPaymentModalProps) {
  const today = new Date()
  const pad2  = (n: number) => String(n).padStart(2, '0')
  const defaultDateStr = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}T${pad2(today.getHours())}:${pad2(today.getMinutes())}`

  const [block, setBlock]             = useState(prefillBlock ?? '')
  const [flat, setFlat]               = useState(prefillFlat ?? '')
  const [amount, setAmount]           = useState('')
  const [mode, setMode]               = useState<PaymentMode | ''>('')
  const [paymentDate, setPaymentDate] = useState(defaultDateStr)
  const [lateFee, setLateFee]         = useState('')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [notes, setNotes]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [showSummary, setShowSummary] = useState(false)
  const [flatFlats, setFlatFlats]     = useState<string[]>([])
  const [showBlockDrop, setShowBlockDrop] = useState(false)
  const [showFlatDrop, setShowFlatDrop]   = useState(false)

  useEffect(() => {
    if (!open) return
    setBlock(prefillBlock ?? ''); setFlat(prefillFlat ?? '')
    setErrors({}); setShowSummary(false)
    if (editMode && editPrefill) {
      setAmount(String(editPrefill.amount)); setMode(editPrefill.mode)
      setLateFee(editPrefill.lateFee > 0 ? String(editPrefill.lateFee) : '')
      setNotes(editPrefill.notes ?? '')
      const d = new Date(editPrefill.paidAt)
      const p = (n: number) => String(n).padStart(2, '0')
      setPaymentDate(`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`)
      setSelectedMonths([editPrefill.billingMonth])
    } else {
      setAmount(''); setMode(''); setPaymentDate(defaultDateStr)
      setLateFee(''); setSelectedMonths([]); setNotes('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillBlock, prefillFlat, editMode])

  useEffect(() => {
    if (!block) return
    const list = FLAT_STRUCTURE.filter(f => f.block === block).map(f => f.flat)
    setFlatFlats(list)
    if (prefillFlat) setFlat(prefillFlat)
    else if (!list.includes(flat)) setFlat('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block])

  const paidMonthKeys = useMemo(() => new Set(existingPayments.map(p => p.billingMonth)), [existingPayments])
  const monthOptions  = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const key = `2026-${pad2(i + 1)}`
    return { key, label: `${MONTH_LABELS[i]} 2026`, paid: paidMonthKeys.has(key) }
  }), [paidMonthKeys])

  const toggleMonth = (key: string, paid: boolean) => {
    if (paid) return
    setSelectedMonths(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key])
    setErrors(e => ({ ...e, months: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!block)  e.block = 'Select a block'
    if (!flat)   e.flat  = 'Select a flat'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'Enter a valid amount greater than zero'
    if (!mode)   e.mode  = 'Select payment mode'
    if (!paymentDate) e.paymentDate = 'Select payment date & time'
    if (!editMode && selectedMonths.length === 0) e.months = 'Select at least one billing month'
    return e
  }

  const handleReview = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({}); setShowSummary(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true); setErrors({})
    try {
      // Build a proper IST offset string: parse the local datetime input,
      // then express it as +05:30 (not UTC shifted to +05:30).
      const localDate = new Date(paymentDate)
      const pad = (n: number) => String(n).padStart(2, '0')
      const paidAt = `${localDate.getFullYear()}-${pad(localDate.getMonth()+1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}:00+05:30`
      if (editMode && editPaymentId) {
        const payload: EditPaymentPayload = {
          mode: mode as EditPaymentPayload['mode'], paidAt,
          amount: Number(amount),
          ...(lateFee && Number(lateFee) > 0 ? { lateFee: Number(lateFee) } : {}),
          notes: notes || undefined,
        }
        await api.editPayment(editPaymentId, payload)
      } else if (editMode && !editPaymentId) {
        throw new Error('Payment ID not available — please refresh and try again.')
      } else {
        const payload: RecordPaymentByFlatPayload = {
          blockName: block.toUpperCase(), flatNumber: flat,
          billingMonth: [...selectedMonths].sort(),
          amount: Number(amount), mode: mode as 'ONLINE' | 'CASH', paidAt,
          notes: notes || undefined,
          ...(lateFee && Number(lateFee) > 0 ? { lateFee: Number(lateFee) } : {}),
        }
        await api.recordPaymentByFlat(payload)
      }
      onSuccess()
    } catch (err: any) {
      console.error('[AddPaymentModal] handleSubmit error:', err)
      setErrors({ submit: err?.message ?? 'Failed to save payment. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const selectedMonthLabels = selectedMonths.sort().map(k => MONTH_LABELS[parseInt(k.split('-')[1], 10) - 1])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.18s ease' }} />
      <div style={{ position: 'fixed', zIndex: 1001, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 560, maxHeight: '92vh', background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(15,23,42,0.22)', display: 'flex', flexDirection: 'column', animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: editMode ? '#7c3aed18' : '#16a34a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {editMode ? <Edit2 size={18} color="#7c3aed" /> : <Plus size={18} color="#16a34a" />}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{editMode ? 'Edit Payment' : 'Record Payment'}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                {prefillBlock && prefillFlat ? `${prefillBlock} · Flat ${prefillFlat}` : editMode ? 'Update payment details below' : 'Select flat and fill payment details'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} color="#64748b" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {showSummary ? (
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Review Payment</p>
              <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {([
                  ['Block', block], ['Flat', flat],
                  ['Months', selectedMonthLabels.join(', ')],
                  ['Amount', `₹${Number(amount).toLocaleString('en-IN')}`],
                  ['Mode', mode],
                  ...(lateFee && Number(lateFee) > 0 ? [['Late Fee', `₹${Number(lateFee).toLocaleString('en-IN')}`]] : []),
                  ['Date', new Date(paymentDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
                  ...(notes ? [['Notes', notes]] : []),
                ] as [string, string][]).map(([label, value], i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '11px 16px', borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, minWidth: 80 }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 700, textAlign: 'right', maxWidth: 280 }}>{value}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedMonths.sort().map(k => {
                  const idx = parseInt(k.split('-')[1], 10) - 1
                  return <span key={k} style={{ padding: '4px 10px', borderRadius: 20, background: '#16a34a14', color: '#15803d', fontSize: 12, fontWeight: 700, border: '1px solid #86efac' }}>{'\u2713'} {MONTH_LABELS[idx]} 2026</span>
                })}
              </div>
              {errors.submit && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#b91c1c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#dc2626" /> {errors.submit}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Edit mode: locked transaction context — covered months as chips, no per-month editing */}
              {editMode ? (
                <>
                  {/* Flat + transaction identity */}
                  <div style={{ padding: '12px 16px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 10 }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Flat</p>
                        <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{prefillBlock} · {prefillFlat}</p>
                      </div>
                      <div style={{ width: 1, height: 32, background: '#e2e8f0' }} />
                      {/* Covered months as locked chips — architecture rule: months are not independently editable */}
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Covers {((editPrefill as any)?.paidMonths?.length ?? 1) > 1
                            ? `${(editPrefill as any).paidMonths.length} months`
                            : 'month'}
                        </p>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(() => {
                            const months: string[] = (editPrefill as any)?.paidMonths?.length
                              ? (editPrefill as any).paidMonths
                              : editPrefill?.billingMonth ? [editPrefill.billingMonth] : []
                            return months.map(bm => {
                              const [yr, ms] = bm.split('-')
                              const label = `${MONTH_LABELS[parseInt(ms, 10) - 1]} ${yr}`
                              return (
                                <span key={bm} style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                  {label}
                                </span>
                              )
                            })
                          })()}
                        </div>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: 10, color: '#94a3b8', fontWeight: 600, background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: 6 }}>🔒 locked</span>
                    </div>
                    {/* Hint: how to change months */}
                    <p style={{ margin: 0, fontSize: 11, color: '#64748b', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 7, padding: '7px 10px', lineHeight: 1.55 }}>
                      ℹ️ <strong>To change which months this payment covers</strong>, delete this transaction and record a new one. This preserves your full audit history.
                    </p>
                  </div>

                  {/* Live total preview */}
                  <div style={{ padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>Total collected after save</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                      ₹{((Number(amount) || 0) + (Number(lateFee) || 0)).toLocaleString('en-IN')}
                      {editPrefill && (Number(amount) || 0) + (Number(lateFee) || 0) !== editPrefill.amount && (
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginLeft: 8 }}>
                          (was ₹{editPrefill.amount.toLocaleString('en-IN')})
                        </span>
                      )}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ModalField label="Block" error={errors.block}>
                    {prefillBlock ? <div style={lockedFieldStyle}>{prefillBlock}</div> : (
                      <ModalSelect value={block || 'Select Block'} open={showBlockDrop} setOpen={setShowBlockDrop} options={ALL_BLOCKS}
                        onChange={v => { setBlock(v); setErrors(e => ({...e, block:''})) }} placeholder="Select Block" hasError={!!errors.block} />
                    )}
                  </ModalField>
                  <ModalField label="Flat Number" error={errors.flat}>
                    {prefillFlat ? <div style={lockedFieldStyle}>{prefillFlat}</div> : (
                      <ModalSelect value={flat || 'Select Flat'} open={showFlatDrop} setOpen={setShowFlatDrop} options={flatFlats}
                        onChange={v => { setFlat(v); setErrors(e => ({...e, flat:''})) }}
                        placeholder={block ? 'Select Flat' : 'Select Block first'} disabled={!block} hasError={!!errors.flat} />
                    )}
                  </ModalField>
                </div>
              )}

              {/* Amount + Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ModalField label="Payment Amount (₹)" error={errors.amount}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>₹</span>
                    <input type="number" min="1" value={amount} onChange={e => { setAmount(e.target.value); setErrors(er => ({...er, amount:''})) }} placeholder="0"
                      style={{ ...inputStyle, paddingLeft: 28, borderColor: errors.amount ? '#fca5a5' : '#e2e8f0' }} />
                  </div>
                </ModalField>
                <ModalField label="Payment Mode" error={errors.mode}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['ONLINE', 'CASH'] as PaymentMode[]).map(m => (
                      <button key={m} onClick={() => { setMode(m); setErrors(e => ({...e, mode:''})) }} style={{
                        flex: 1, height: 40, borderRadius: 8, border: '1.5px solid',
                        borderColor: mode === m ? (m === 'ONLINE' ? '#7c3aed' : '#f59e0b') : errors.mode ? '#fca5a5' : '#e2e8f0',
                        background: mode === m ? (m === 'ONLINE' ? '#7c3aed0f' : '#f59e0b0f') : '#fff',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        color: mode === m ? (m === 'ONLINE' ? '#7c3aed' : '#d97706') : '#64748b',
                        transition: 'all 0.15s ease',
                      }}>
                        {m === 'ONLINE' ? '\uD83C\uDF10 ONLINE' : '\uD83D\uDCB5 CASH'}
                      </button>
                    ))}
                  </div>
                </ModalField>
              </div>

              {/* Date + Late Fee */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ModalField label="Payment Date & Time" error={errors.paymentDate}>
                  <input type="datetime-local" value={paymentDate} onChange={e => { setPaymentDate(e.target.value); setErrors(er => ({...er, paymentDate:''})) }}
                    style={{ ...inputStyle, borderColor: errors.paymentDate ? '#fca5a5' : '#e2e8f0' }} />
                </ModalField>
                <ModalField label="Late Fee (Optional)">
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>₹</span>
                    <input type="number" min="0" value={lateFee} onChange={e => setLateFee(e.target.value)} placeholder="0" style={{ ...inputStyle, paddingLeft: 28 }} />
                  </div>
                </ModalField>
              </div>

              {/* Billing Months (create mode only) */}
              {!editMode && (
                <ModalField label={`Billing Months${selectedMonths.length > 0 ? ` \u00b7 ${selectedMonths.length} selected` : ''}`} error={errors.months}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, padding: '12px', borderRadius: 10, border: `1.5px solid ${errors.months ? '#fca5a5' : '#e2e8f0'}`, background: '#fafbfc' }}>
                    {monthOptions.map(({ key, label, paid }) => {
                      const selected = selectedMonths.includes(key)
                      return (
                        <button key={key} onClick={() => toggleMonth(key, paid)}
                          title={paid ? 'Payment already recorded for this month' : undefined} disabled={paid}
                          style={{ padding: '7px 4px', borderRadius: 7, border: `1.5px solid ${paid ? '#e2e8f0' : selected ? '#16a34a' : '#e2e8f0'}`, background: paid ? '#f8fafc' : selected ? '#f0fdf4' : '#fff', fontSize: 11, fontWeight: 600, cursor: paid ? 'not-allowed' : 'pointer', color: paid ? '#cbd5e1' : selected ? '#15803d' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'all 0.12s ease', opacity: paid ? 0.7 : 1 }}>
                          {(paid || selected) && <span style={{ fontSize: 9, color: paid ? '#94a3b8' : '#16a34a' }}>{'\u2713'}</span>}
                          {label.split(' ')[0]}
                        </button>
                      )
                    })}
                  </div>
                  {selectedMonths.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                      {selectedMonths.sort().map(k => {
                        const idx = parseInt(k.split('-')[1], 10) - 1
                        return (
                          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 20, background: '#16a34a14', color: '#15803d', fontSize: 11, fontWeight: 700, border: '1px solid #86efac' }}>
                            {MONTH_LABELS[idx]} 2026
                            <button onClick={() => setSelectedMonths(m => m.filter(x => x !== k))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 2 }}>
                              <X size={10} color="#16a34a" />
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                </ModalField>
              )}

              {/* Notes */}
              <ModalField label="Notes / Remarks (Optional)">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Collected at gate, receipt given manually" rows={2}
                  style={{ ...inputStyle, height: 'auto', resize: 'none', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10 }} />
              </ModalField>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexShrink: 0, background: '#fafbfc' }}>
          {showSummary ? (
            <>
              <button onClick={() => setShowSummary(false)} style={btnSecondaryStyle} disabled={submitting}>{'\u2190'} Edit</button>
              <button onClick={handleSubmit} disabled={submitting} style={{ ...btnPrimaryStyle, background: submitting ? '#86efac' : '#16a34a', display: 'flex', alignItems: 'center', gap: 6 }}>
                {submitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving\u2026</> : editMode ? '\u2713 Update Payment' : '\u2713 Confirm & Save'}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={btnSecondaryStyle}>Cancel</button>
              <button onClick={handleReview} style={{ ...btnPrimaryStyle, background: '#16a34a' }}>Review Payment {'\u2192'}</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────
// Architecture rules implemented here:
//  • Delete always voids the ENTIRE transaction — no "delete just one month"
//  • Show exactly which months will revert to PENDING
//  • Require a reason before confirming (adds friction + provides audit context)
//  • Soft-delete language ("void" not "erase") to set correct expectations

const DELETE_REASONS = [
  'Duplicate entry',
  'Wrong flat / block entered',
  'Payment bounced / reversed',
  'Data entry error',
  'Other',
]

function DeleteModal({ open, payment, flatLabel, onClose, onConfirm }: {
  open: boolean; payment: Payment | null; flatLabel: string
  onClose: () => void; onConfirm: () => Promise<void>
}) {
  const [deleting, setDeleting]     = useState(false)
  const [error, setError]           = useState('')
  const [reason, setReason]         = useState('')
  const [showReasonDrop, setShowReasonDrop] = useState(false)
  useEffect(() => { if (open) { setDeleting(false); setError(''); setReason('') } }, [open])
  if (!open || !payment) return null

  const coveredMonths = payment.paidMonths?.length
    ? payment.paidMonths.map(bm => { const [yr, ms] = bm.split('-'); return { bm, label: `${MONTH_LABELS[parseInt(ms,10)-1]} ${yr}` } })
    : [{ bm: payment.billingMonth, label: MONTH_LABELS[(payment.month ?? 1) - 1] + ' 2026' }]
  const coveredCount  = coveredMonths.length
  const canConfirm    = reason.trim().length > 0 && !deleting

  const handleConfirm = async () => {
    if (!reason.trim()) return
    setDeleting(true); setError('')
    try { await onConfirm() }
    catch (err: any) { setError(err?.message ?? 'Failed to delete. Please try again.'); setDeleting(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)', animation: 'fadeIn 0.18s ease' }} />
      <div style={{ position: 'fixed', zIndex: 1001, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', maxWidth: 460, background: '#fff', borderRadius: 20, boxShadow: '0 24px 80px rgba(15,23,42,0.22)', animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Trash2 size={18} color="#dc2626" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Delete Payment Transaction</p>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>This will be voided and preserved in audit history</p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={15} color="#64748b" />
          </button>
        </div>

        <div style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Impact warning — which months revert to PENDING */}
          <div style={{ padding: '12px 14px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca' }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#b91c1c' }}>
              ⚠️ {coveredCount === 1 ? '1 month' : `${coveredCount} months`} will revert to <strong>UNPAID</strong>
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {coveredMonths.map(({ bm, label }) => (
                <span key={bm} style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: '#fff', border: '1.5px solid #fca5a5', borderRadius: 5, padding: '2px 8px' }}>
                  {label}
                </span>
              ))}
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#7f1d1d', lineHeight: 1.55 }}>
              <strong>{flatLabel}</strong> will reappear as unpaid for {coveredCount > 1 ? 'these months' : 'this month'}. The original receipt will be voided.
            </p>
          </div>

          {/* Transaction details */}
          <div style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {[
              ['Total amount', `₹${payment.amount.toLocaleString('en-IN')}`],
              ['Mode', payment.mode],
              ['Payment date', payment.date || '-'],
              ...(payment.notes ? [['Notes', payment.notes]] : []),
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#fafbfc' }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{k}</span>
                <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Required reason — provides audit context and adds friction to prevent accidents */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Reason for deletion <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowReasonDrop(d => !d)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 14px', height: 40, borderRadius: 8, border: `1.5px solid ${!reason && error ? '#fca5a5' : reason ? '#86efac' : '#e2e8f0'}`, background: '#fff', fontSize: 13, fontWeight: reason ? 600 : 400, color: reason ? '#0f172a' : '#94a3b8', cursor: 'pointer', textAlign: 'left' }}
              >
                <span>{reason || 'Select a reason…'}</span>
                <ChevronDown size={14} color="#94a3b8" />
              </button>
              {showReasonDrop && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowReasonDrop(false)} />
                  <div style={{ position: 'absolute', top: '108%', left: 0, right: 0, zIndex: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.1)', overflow: 'hidden' }}>
                    {DELETE_REASONS.map(r => (
                      <button key={r} onClick={() => { setReason(r); setShowReasonDrop(false) }}
                        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: r === reason ? '#fef2f2' : '#fff', color: r === reason ? '#dc2626' : '#0f172a', fontWeight: r === reason ? 700 : 400 }}
                        onMouseEnter={e => { if (r !== reason) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                        onMouseLeave={e => { if (r !== reason) (e.currentTarget as HTMLElement).style.background = '#fff' }}
                      >{r}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {!reason && (
              <p style={{ margin: '5px 0 0', fontSize: 11, color: '#94a3b8' }}>Required — stored in audit log for future reference</p>
            )}
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#b91c1c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={14} color="#dc2626" /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10, background: '#fafbfc' }}>
          <button onClick={onClose} style={btnSecondaryStyle} disabled={deleting}>Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            title={!reason ? 'Select a reason to continue' : ''}
            style={{
              ...btnDangerStyle,
              background: !canConfirm ? '#fca5a5' : deleting ? '#fca5a5' : '#dc2626',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', gap: 6,
              opacity: !canConfirm ? 0.7 : 1,
            }}
          >
            {deleting
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deleting…</>
              : <><Trash2 size={14} /> Void Transaction</>
            }
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Flat Detail Side Panel ───────────────────────────────────────────────────

function FlatPanel({ open, flat, onClose, onAddPayment, onEditPayment, onDeletePayment }: {
  open: boolean; flat: Flat | null; onClose: () => void
  onAddPayment: (block: string, flat: string, payments: Payment[]) => void
  onEditPayment: (f: Flat, p: Payment) => void
  onDeletePayment: (f: Flat, p: Payment) => void
}) {
  if (!open || !flat) return null
  // Only real transactions (isAnchorMonth=true); exclude heatmap-only clones
  const anchorPmts    = flat.payments.filter(p => p.isAnchorMonth !== false)
  const totalPaid     = anchorPmts.reduce((s, p) => s + p.amount, 0)
  // Collect all paid month numbers across all transactions (including multi-month ones)
  const paidMonthNums = new Set(flat.payments.map(p => p.month))

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(15,23,42,0.35)', animation: 'fadeIn 0.18s ease' }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 901, width: '100%', maxWidth: 420, background: '#fff', boxShadow: '-8px 0 40px rgba(15,23,42,0.12)', display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.25s ease' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#16a34a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Home size={16} color="#16a34a" />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{flat.block} \u00b7 Flat {flat.flat}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{anchorPmts.length} transaction{anchorPmts.length !== 1 ? 's' : ''} · {paidMonthNums.size} month{paidMonthNums.size !== 1 ? 's' : ''} covered</p>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={15} color="#64748b" />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Paid</p>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#166534' }}>₹{totalPaid.toLocaleString('en-IN')}</p>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Months Paid</p>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{paidMonthNums.size} / 12</p>
            </div>
            <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending</p>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 800, color: 12 - paidMonthNums.size > 0 ? '#dc2626' : '#16a34a' }}>{12 - paidMonthNums.size}</p>
            </div>
          </div>
        </div>

        {/* Mini heatmap — 2026 at a glance */}
        <div style={{ padding: '12px 24px 8px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>2026 at a glance</p>
          <div style={{ display: 'flex', gap: 3 }}>
            {MONTHS.map((m, i) => {
              const paid   = paidMonthNums.has(i + 1)
              const pmt    = flat.payments.find(p => p.month === i + 1)
              const online = pmt?.mode === 'ONLINE'
              // Tooltip: status + transaction context, never a per-month split amount
              const coveredLabels = pmt?.paidMonths?.map(bm => {
                const [, ms] = bm.split('-')
                return MONTH_LABELS[parseInt(ms, 10) - 1] ?? bm
              })
              const tipMulti = (coveredLabels?.length ?? 1) > 1 ? ` · covers ${coveredLabels!.join(' + ')}` : ''
              const tip = paid
                ? `${MONTH_LABELS[i]}: Paid ${pmt?.date ?? ''} · ₹${pmt?.transactionAmount?.toLocaleString('en-IN')} total · ${pmt?.mode}${tipMulti}`
                : `${MONTH_LABELS[i]}: Not paid`
              return (
                <div
                  key={m} title={tip}
                  onClick={() => paid && pmt && onEditPayment(flat, pmt)}
                  style={{
                    flex: 1, height: 28, borderRadius: 5, position: 'relative',
                    background: paid ? (online ? '#ede9fe' : '#f0fdf4') : '#f1f5f9',
                    border: `1.5px solid ${paid ? (online ? '#a78bfa' : '#86efac') : '#e2e8f0'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 700,
                    color: paid ? (online ? '#7c3aed' : '#15803d') : '#94a3b8',
                    cursor: paid ? 'pointer' : 'default',
                    transition: 'transform 0.1s ease',
                  }}
                  onMouseEnter={e => { if (paid) (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                >
                  {/* Mode dot */}
                  {paid && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 4, height: 4, borderRadius: '50%',
                      background: online ? '#7c3aed' : '#16a34a',
                    }} />
                  )}
                  {m.slice(0, 1)}
                </div>
              )
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginTop: 7, fontSize: 10, color: '#94a3b8' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />Cash
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', display: 'inline-block' }} />Online
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 4, fontStyle: 'italic' }}>Click a paid cell to edit its transaction</span>
          </div>
        </div>

        {/* Transaction ledger */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Transactions — {anchorPmts.length} record{anchorPmts.length !== 1 ? 's' : ''}
          </p>
          {anchorPmts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
              <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No payments yet</p>
              <p style={{ margin: '6px 0 0', fontSize: 12 }}>Record the first payment for this flat</p>
            </div>
          ) : (
            anchorPmts
              .slice()
              .sort((a, b) => {
                const parse = (d: string) => { const [dd,mm,yyyy] = d.split('/'); return new Date(+yyyy, +mm-1, +dd).getTime() }
                return (b.date ? parse(b.date) : 0) - (a.date ? parse(a.date) : 0)
              })
              .map(payment => {
                const online   = payment.mode === 'ONLINE'
                const modeColor = online ? '#7c3aed' : '#d97706'
                const modeBg    = online ? '#ede9fe'  : '#fef9c3'
                const pmMonths  = payment.paidMonths?.length ? payment.paidMonths : [payment.billingMonth]
                const pmLabels  = pmMonths.map(bm => {
                  const [yr, ms] = bm.split('-')
                  return `${MONTH_LABELS[parseInt(ms,10)-1]} ${yr}`
                })
                const isMulti  = pmLabels.length > 1
                const txnRef   = payment.receiptNumber ?? payment.transactionRef ?? ''
                return (
                  <div key={payment.transactionId ?? payment.id}
                    style={{ borderRadius: 12, marginBottom: 10, background: '#fff', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                    {/* Card header: months chips + locked badge */}
                    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f8fafc', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {pmLabels.map(label => (
                          <span key={label} style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 5, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                            {label}
                          </span>
                        ))}
                        {isMulti && (
                          <span style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginLeft: 2 }}>
                            · {pmLabels.length} months · 1 transaction
                          </span>
                        )}
                      </div>
                      {txnRef && (
                        <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#94a3b8', background: '#f1f5f9', borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap' }}>
                          {txnRef}
                        </span>
                      )}
                    </div>

                    {/* Card body: amount + date + mode */}
                    <div style={{ padding: '10px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>
                            ₹{payment.amount.toLocaleString('en-IN')}
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: modeColor, background: modeBg, borderRadius: 20, padding: '2px 8px' }}>
                            {payment.mode}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                          {payment.date && (
                            <span style={{ fontSize: 11, color: '#64748b' }}>{payment.date}</span>
                          )}
                          {payment.lateFee > 0 && (
                            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600, background: '#fef2f2', borderRadius: 4, padding: '1px 5px' }}>
                              +₹{payment.lateFee} late fee
                            </span>
                          )}
                        </div>
                        {payment.notes && (
                          <p style={{ margin: '5px 0 0', fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                            "{payment.notes}"
                          </p>
                        )}
                      </div>

                      {/* Edit / Delete actions */}
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          onClick={() => onEditPayment(flat, payment)}
                          title="Edit transaction (date, mode, amount, notes)"
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all 0.12s ease' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#f0fdf4'; el.style.borderColor = '#86efac' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff'; el.style.borderColor = '#e2e8f0' }}
                        >
                          <Edit2 size={13} color="#64748b" />
                        </button>
                        <button
                          onClick={() => onDeletePayment(flat, payment)}
                          title={`Delete this transaction — ${pmLabels.length} month${pmLabels.length > 1 ? 's' : ''} will revert to unpaid`}
                          style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all 0.12s ease' }}
                          onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fef2f2'; el.style.borderColor = '#fca5a5' }}
                          onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff'; el.style.borderColor = '#e2e8f0' }}
                        >
                          <Trash2 size={13} color="#94a3b8" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0, background: '#fafbfc', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...btnSecondaryStyle, flex: 1 }}>Close</button>
          <button onClick={() => onAddPayment(flat.block, flat.flat, flat.payments)} style={{ ...btnPrimaryStyle, flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={14} /> Add Payment
          </button>
        </div>
      </div>
    </>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, color, label, value, sub, pct, barColor, loading }: {
  icon: React.ReactNode; color: string; label: string; value: string
  sub: string; pct: number; barColor: string; loading?: boolean
}) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: '#fff', borderRadius: 16, border: '1px solid #e8edf3', padding: '22px 24px 18px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: '50%', background: color, opacity: 0.06 }} />
      <div style={{ width: 38, height: 38, borderRadius: 10, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
      <div>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</p>
        {loading
          ? <div style={{ marginTop: 6, height: 28, width: 100, borderRadius: 6, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
          : <p style={{ margin: '4px 0 0', fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</p>
        }
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
// Architecture rule: cells show PAID/OVERDUE status only — never a per-month
// split amount (₹400÷2=₹200 never existed as a DB record). Tooltip surfaces
// the full transaction context. Click opens the parent transaction for editing.

function PaymentCell({ payment, loading, onEdit }: { payment?: Payment; loading?: boolean; onEdit?: () => void }) {
  if (loading) return (
    <td style={{ padding: '6px 2px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 42, height: 22, borderRadius: 6, background: '#f1f5f9', margin: '0 auto', animation: 'pulse 1.5s ease-in-out infinite' }} />
    </td>
  )

  if (!payment) return (
    <td style={{ padding: '6px 2px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ margin: '0 auto', width: 42, height: 22, borderRadius: 6, background: '#f8fafc', border: '1.5px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700 }}>—</span>
      </div>
    </td>
  )

  const isOnline     = payment.mode === 'ONLINE'
  const dotColor     = isOnline ? '#7c3aed' : '#16a34a'
  const coveredCount = payment.paidMonths?.length ?? 1
  const isMultiMonth = coveredCount > 1

  const coveredLabels = (payment.paidMonths ?? [payment.billingMonth]).map(bm => {
    const [, ms] = bm.split('-')
    return MONTH_LABELS[parseInt(ms, 10) - 1] ?? bm
  })
  // transactionAmount is the real total on both anchor and clone rows.
  // payment.amount would be 0 on a clone — never use it for display.
  const tooltipText = [
    `Paid ${payment.date}`,
    `₹${payment.transactionAmount.toLocaleString('en-IN')} total`,
    payment.mode,
    isMultiMonth ? `Covers: ${coveredLabels.join(' + ')}` : null,
    payment.notes ? `Note: ${payment.notes}` : null,
    'Click to view transaction',
  ].filter(Boolean).join(' · ')

  return (
    <td
      onClick={onEdit}
      title={tooltipText}
      style={{
        padding: '5px 2px', textAlign: 'center',
        borderBottom: '1px solid #f1f5f9',
        cursor: onEdit ? 'pointer' : 'default',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={e => { if (onEdit) (e.currentTarget as HTMLElement).style.background = '#f0fdf4' }}
      onMouseLeave={e => { if (onEdit) (e.currentTarget as HTMLElement).style.background = '' }}
    >
      <div style={{
        margin: '0 auto', width: 42,
        borderRadius: 6,
        background: '#dcfce7',
        border: `1.5px solid ${isMultiMonth ? '#86efac' : '#a7f3d0'}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 0, padding: '3px 2px', position: 'relative', overflow: 'visible',
      }}>
        {/* Mode dot — top right */}
        <span style={{
          position: 'absolute', top: 2, right: 2,
          width: 5, height: 5, borderRadius: '50%',
          background: dotColor,
          flexShrink: 0,
        }} />
        {/* PAID label */}
        <span style={{ fontSize: 9, fontWeight: 800, color: '#15803d', letterSpacing: '0.04em' }}>PAID</span>
        {/* Multi-month badge */}
        {isMultiMonth && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: '#7c3aed',
            background: '#ede9fe', borderRadius: 3,
            padding: '0 3px', lineHeight: '12px', whiteSpace: 'nowrap',
          }}>{coveredCount}mo</span>
        )}
      </div>
    </td>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────────────
// Architecture rule: one calendar event per PaymentTransaction, placed on the
// payment date (processedAt). Multi-month transactions show ALL covered months
// as chips. Amount shown is the real total, never a per-month split.

function CalendarView({ flats, loading, onFlatClick }: { flats: Flat[]; loading: boolean; onFlatClick: (f: Flat) => void }) {
  // Collect one entry per ANCHOR transaction. Since a multi-month transaction
  // covers e.g. Jan+Feb, we place it in the calendar month matching its
  // billingMonth (which is the anchor/earliest covered month).
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {MONTHS.map((mon, mi) => {
        const monthKey  = `2026-${String(mi + 1).padStart(2, '0')}`
        // Only anchor rows whose billingMonth falls in this calendar slot
        type AnchorRow = Payment & { flatRef: Flat }
        const events: AnchorRow[] = loading ? [] : flats.flatMap(f =>
          f.payments
            .filter(p => p.isAnchorMonth !== false && p.billingMonth === monthKey)
            .map(p => ({ ...p, flatRef: f }))
        )
        const totalCollected = events.reduce((s, e) => s + e.amount, 0)
        const onlineCount    = events.filter(e => e.mode === 'ONLINE').length
        const cashCount      = events.filter(e => e.mode === 'CASH').length

        return (
          <div key={mon} style={{ borderRadius: 14, border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Month header */}
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em' }}>{mon}</span>
              {totalCollected > 0
                ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a' }}>₹{(totalCollected / 1000).toFixed(1)}K</span>
                : <span style={{ fontSize: 11, color: '#94a3b8' }}>₹0</span>
              }
            </div>

            {/* Event cards — one per transaction */}
            <div style={{ padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 60 }}>
              {loading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} style={{ height: 38, borderRadius: 7, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  ))
                : events.length === 0
                  ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#e2e8f0', fontSize: 11, fontWeight: 600, paddingBottom: 8 }}>No payments</div>
                  : events.slice(0, 8).map(ev => {
                      const isOnline = ev.mode === 'ONLINE'
                      const borderCol = isOnline ? '#a78bfa' : '#86efac'
                      const bgCol     = isOnline ? '#faf5ff' : '#f0fdf4'
                      // All covered months as chips — the KEY visual: one card, multiple month chips
                      const coveredChips = (ev.paidMonths?.length ? ev.paidMonths : [ev.billingMonth]).map(bm => {
                        const [, ms] = bm.split('-')
                        return MONTH_LABELS[parseInt(ms, 10) - 1] ?? bm
                      })
                      const isMulti = coveredChips.length > 1
                      return (
                        <div
                          key={ev.transactionId ?? ev.id}
                          onClick={() => onFlatClick(ev.flatRef)}
                          title={`${ev.flatRef.block} / ${ev.flatRef.flat} · ₹${ev.amount.toLocaleString('en-IN')} · ${ev.mode}${isMulti ? ' · Multi-month: ' + coveredChips.join('+') : ''} · Click to view`}
                          style={{ padding: '7px 9px', borderRadius: 8, background: bgCol, border: `1.5px solid ${borderCol}`, cursor: 'pointer', transition: 'transform 0.1s ease' }}
                          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1.02)')}
                          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                        >
                          {/* Row 1: amount + mode */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                              ₹{ev.amount.toLocaleString('en-IN')}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: isOnline ? '#7c3aed' : '#16a34a', background: isOnline ? '#ede9fe' : '#dcfce7', borderRadius: 4, padding: '1px 5px' }}>
                              {ev.mode}
                            </span>
                          </div>
                          {/* Row 2: month chips (THE key architecture rule — show all covered months) */}
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 3 }}>
                            {coveredChips.map(chip => (
                              <span key={chip} style={{ fontSize: 9, fontWeight: 700, color: '#1d4ed8', background: '#dbeafe', borderRadius: 3, padding: '1px 4px', whiteSpace: 'nowrap' }}>{chip}</span>
                            ))}
                          </div>
                          {/* Row 3: flat + date */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{ev.flatRef.block} / {ev.flatRef.flat}</span>
                            {ev.date && <span style={{ fontSize: 9, color: '#94a3b8' }}>{ev.date}</span>}
                          </div>
                        </div>
                      )
                    })
              }
              {!loading && events.length > 8 && (
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, textAlign: 'center', padding: '3px 0' }}>
                  +{events.length - 8} more
                </div>
              )}
            </div>

            {/* Footer counts */}
            <div style={{ padding: '6px 12px 10px', display: 'flex', gap: 10, fontSize: 10, borderTop: events.length > 0 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#7c3aed', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block' }} />{onlineCount} online
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#d97706', fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fcd34d', display: 'inline-block' }} />{cashCount} cash
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Recent Transactions ──────────────────────────────────────────────────────

// ─── Transaction History (Ledger) ─────────────────────────────────────────────
// Architecture rule: one row per PaymentTransaction. The "Covers months" column
// with chips is the primary UX fix — it makes multi-month transactions obvious
// and prevents admins from assuming ₹400 is two separate ₹200 payments.

function RecentView({ flats, loading, onEdit, onDelete }: {
  flats: Flat[]; loading: boolean
  onEdit: (f: Flat, p: Payment) => void
  onDelete: (f: Flat, p: Payment) => void
}) {
  type Row = Payment & { flatRef: Flat }
  const rows: Row[] = useMemo(() =>
    flats.flatMap(f =>
      f.payments
        .filter(p => p.isAnchorMonth !== false)   // anchor rows only — no heatmap clones
        .map(p => ({ ...p, flatRef: f }))
    ).sort((a, b) => {
      const parse = (d: string) => { const [dd,mm,yyyy] = d.split('/'); return new Date(+yyyy, +mm-1, +dd).getTime() }
      return (b.date ? parse(b.date) : 0) - (a.date ? parse(a.date) : 0)
    })
  , [flats])

  if (loading) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
      <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
      Loading transactions…
    </div>
  )
  if (rows.length === 0) return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
      <Receipt size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No transactions recorded yet</p>
    </div>
  )

  return (
    <div style={{ width: '100%', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ background: '#0f172a' }}>
            {[
              ['Date',          '10%'],
              ['Block',         '11%'],
              ['Flat',           '7%'],
              ['Covers months', '20%'],   // THE key column — chips show all months per transaction
              ['Amount',        '10%'],
              ['Late fee',       '8%'],
              ['Mode',           '9%'],
              ['Ref',           '12%'],
              ['Notes',         'auto'],
              ['',               '8%'],
            ].map(([h, w]) => (
              <th key={h} style={{
                padding: '10px 10px',
                textAlign: h === 'Amount' || h === 'Late fee' ? 'right' : h === 'Covers months' ? 'center' : 'left',
                fontSize: 10, fontWeight: 700, color: h === 'Covers months' ? '#34d399' : '#94a3b8',
                letterSpacing: '0.06em', textTransform: 'uppercase', width: w,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 120).map(({ flatRef, ...payment }, idx) => {
            const isOnline    = payment.mode === 'ONLINE'
            const modeColor   = isOnline ? '#7c3aed' : '#d97706'
            // Covered months chips — the architectural fix for multi-month confusion
            const coveredBms  = payment.paidMonths?.length ? payment.paidMonths : [payment.billingMonth]
            const chipLabels  = coveredBms.map(bm => {
              const [yr, ms] = bm.split('-')
              return { bm, label: `${MONTH_LABELS[parseInt(ms, 10) - 1]} ${yr}` }
            })
            const isMulti     = chipLabels.length > 1
            const txnRef      = payment.receiptNumber ?? payment.transactionRef ?? ''
            const deleteTip   = `Delete transaction — ${chipLabels.length} month${chipLabels.length > 1 ? 's' : ''} (${chipLabels.map(c => c.label).join(', ')}) will revert to unpaid`

            return (
              <tr key={`${payment.transactionId ?? payment.id}-${idx}`}
                style={{ background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}>

                <td style={{ padding: '10px 10px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                  {payment.date || '-'}
                </td>
                <td style={{ padding: '10px 10px', fontSize: 12, color: '#64748b', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {flatRef.block}
                </td>
                <td style={{ padding: '10px 10px', fontSize: 12, fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>
                  {flatRef.flat}
                </td>

                {/* THE key column — month chips make multi-month nature obvious */}
                <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    {chipLabels.map(({ bm, label }) => (
                      <span key={bm} style={{
                        fontSize: 10, fontWeight: 700,
                        color: '#1d4ed8', background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: 4, padding: '2px 6px', whiteSpace: 'nowrap',
                      }}>{label}</span>
                    ))}
                    {isMulti && (
                      <span style={{ fontSize: 9, color: '#94a3b8', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                        · 1 txn
                      </span>
                    )}
                  </div>
                </td>

                {/* Real total amount — never a per-month split */}
                <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 13, fontWeight: 800, color: '#0f172a', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                  ₹{payment.amount.toLocaleString('en-IN')}
                </td>

                <td style={{ padding: '10px 10px', textAlign: 'right', fontSize: 12, color: payment.lateFee > 0 ? '#dc2626' : '#94a3b8', fontWeight: payment.lateFee > 0 ? 700 : 400, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                  {payment.lateFee > 0 ? `₹${payment.lateFee.toLocaleString('en-IN')}` : '—'}
                </td>

                <td style={{ padding: '10px 10px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: modeColor, background: modeColor + '14', borderRadius: 20, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                    {payment.mode}
                  </span>
                </td>

                <td style={{ padding: '10px 10px', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {txnRef
                    ? <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b', background: '#f1f5f9', borderRadius: 4, padding: '2px 5px' }}>{txnRef}</span>
                    : <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                  }
                </td>

                <td style={{ padding: '10px 10px', fontSize: 11, color: '#64748b', borderBottom: '1px solid #f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: payment.notes ? 'italic' : 'normal' }}>
                  {payment.notes || '—'}
                </td>

                <td style={{ padding: '8px 8px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button
                      onClick={() => onEdit(flatRef, payment)}
                      title="Edit transaction (date, mode, amount, notes)"
                      style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#f0fdf4'; el.style.borderColor = '#86efac' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff'; el.style.borderColor = '#e2e8f0' }}
                    >
                      <Edit2 size={11} color="#64748b" />
                    </button>
                    <button
                      onClick={() => onDelete(flatRef, payment)}
                      title={deleteTip}
                      style={{ width: 26, height: 26, borderRadius: 6, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fef2f2'; el.style.borderColor = '#fca5a5' }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff'; el.style.borderColor = '#e2e8f0' }}
                    >
                      <Trash2 size={11} color="#94a3b8" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > 120 && (
        <div style={{ padding: '12px 16px', background: '#fafbfc', borderTop: '1px solid #f1f5f9', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Showing 120 of {rows.length} transactions
        </div>
      )}
    </div>
  )
}

// ─── Tab Button ───────────────────────────────────────────────────────────────

function TabButton({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#0f172a' : '#64748b', background: active ? '#fff' : 'transparent', boxShadow: active ? '0 1px 4px rgba(15,23,42,0.08)' : 'none', transition: 'all 0.15s ease' }}>
      {icon}{label}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const [flats, setFlats]               = useState<Flat[]>([])
  const [globalLoading, setGlobalLoading] = useState(true)
  const [globalError, setGlobalError]   = useState(false)
  const [activeTab, setActiveTab]       = useState<TabView>('heatmap')

  const [blockFilter, setBlockFilter]   = useState('All Blocks')
  const [fieldFilter, setFieldFilter]   = useState('All Fields')
  const [search, setSearch]             = useState('')
  const [showBlockDrop, setShowBlockDrop] = useState(false)
  const [showFieldDrop, setShowFieldDrop] = useState(false)

  const [modalOpen, setModalOpen]       = useState(false)
  const [modalBlock, setModalBlock]     = useState<string | undefined>()
  const [modalFlat, setModalFlat]       = useState<string | undefined>()
  const [modalExistingPayments, setModalExistingPayments] = useState<Payment[]>([])
  const [highlightedFlat, setHighlightedFlat] = useState<string | null>(null)

  const [editModalOpen, setEditModalOpen]       = useState(false)
  const [editPaymentId, setEditPaymentId]       = useState<string | undefined>()
  const [editPrefillBlock, setEditPrefillBlock] = useState<string | undefined>()
  const [editPrefillFlat, setEditPrefillFlat]   = useState<string | undefined>()
  const [editPrefill, setEditPrefill]           = useState<AddPaymentModalProps['editPrefill']>()

  const [deleteOpen, setDeleteOpen]       = useState(false)
  const [deletePayment, setDeletePayment] = useState<Payment | null>(null)
  const [deleteFlatRef, setDeleteFlatRef] = useState<Flat | null>(null)

  const [panelOpen, setPanelOpen] = useState(false)
  const [panelFlat, setPanelFlat] = useState<Flat | null>(null)

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const loadAll = useCallback(async () => {
    setGlobalLoading(true); setGlobalError(false)
    try { setFlats(await fetchAllPayments()) }
    catch { setGlobalError(true); setFlats([]) }
    finally { setGlobalLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Keep panel fresh after reload
  useEffect(() => {
    if (!panelOpen || !panelFlat) return
    const fresh = flats.find(f => f.block === panelFlat.block && f.flat === panelFlat.flat)
    if (fresh) setPanelFlat(fresh)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flats])

  const openGlobalModal = () => { setModalBlock(undefined); setModalFlat(undefined); setModalExistingPayments([]); setModalOpen(true) }
  const openFlatModal   = (block: string, flat: string, payments: Payment[]) => { setModalBlock(block); setModalFlat(flat); setModalExistingPayments(payments); setModalOpen(true) }

  const openEditModal = (f: Flat, payment: Payment) => {
    setEditPaymentId(payment.transactionId ?? payment.id)
    setEditPrefillBlock(f.block); setEditPrefillFlat(f.flat)
    const now = new Date()
    const pad2 = (n: number) => String(n).padStart(2, '0')
    // payment.date is already formatted as dd/mm/yyyy by fmtDate().
    // Reconstruct a datetime-local string for the input; use noon IST as time since
    // we only have the date portion.
    const paidAtStr = payment.date
      ? (() => { const [d,m,y] = payment.date.split('/'); return `${y}-${m}-${d}T12:00` })()
      : `${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}T${pad2(now.getHours())}:${pad2(now.getMinutes())}`
    // payment.amount is the TOTAL transaction amount (real figure from API — no division)
    // Use the anchor billingMonth (earliest covered month) as the display month
    const anchorBillingMonth = payment.paidMonths?.length ? payment.paidMonths[0] : payment.billingMonth
    setEditPrefill({
      amount: payment.amount, lateFee: 0, mode: payment.mode,
      paidAt: paidAtStr,
      notes: payment.notes ?? '', billingMonth: anchorBillingMonth,
      paidMonths: payment.paidMonths?.length ? payment.paidMonths : [anchorBillingMonth],
    } as any)
    setEditModalOpen(true)
  }

  const openDeleteModal = (f: Flat, payment: Payment) => { setDeleteFlatRef(f); setDeletePayment(payment); setDeleteOpen(true) }
  const openFlatPanel   = (f: Flat)                    => { setPanelFlat(f); setPanelOpen(true) }

  const handlePaymentSuccess = async () => {
    setModalOpen(false)
    const key = modalBlock && modalFlat ? `${modalBlock}-${modalFlat}` : null
    setToast({ message: 'Payment recorded successfully.', type: 'success' })
    if (key) { setHighlightedFlat(key); setTimeout(() => setHighlightedFlat(null), 3000) }
    await loadAll()
  }

  const handleDeleteConfirm = async () => {
    // Single DELETE on the master PaymentTransaction id.
    // The server atomically resets all covered MaintenancePayment rows,
    // deletes the receipt, and posts the fund ledger reversal — no loop needed.
    const id = deletePayment?.transactionId ?? deletePayment?.id
    if (!id) throw new Error('Payment ID missing. Please refresh and try again.')
    await api.deletePayment(id)
    setDeleteOpen(false)
    const monthCount = deletePayment?.paidMonths?.length ?? 1
    setToast({ message: `Transaction voided — ${monthCount} month${monthCount > 1 ? 's' : ''} reverted to unpaid.`, type: 'success' })
    await loadAll()
  }

  const allLoading       = globalLoading
  // Only anchor rows (isAnchorMonth=true) are real transactions.
  // Heatmap clones (isAnchorMonth=false) are expansions of multi-month transactions
  // and must be excluded from totals to avoid double-counting.
  const allPayments      = flats.flatMap(f => f.payments.filter(p => p.isAnchorMonth !== false))
  const totalCollection  = allPayments.reduce((s, p) => s + p.amount, 0)
  const onlineCollection = allPayments.filter(p => p.mode === 'ONLINE').reduce((s, p) => s + p.amount, 0)
  const cashCollection   = totalCollection - onlineCollection
  const paidFlats        = flats.filter(f => f.payments.length > 0).length
  const totalFlats       = FLAT_STRUCTURE.length
  const onlinePct        = totalCollection ? Math.round((onlineCollection / totalCollection) * 100) : 0
  const cashPct          = totalCollection ? Math.round((cashCollection   / totalCollection) * 100) : 0
  const paidPct          = totalFlats > 0  ? Math.round((paidFlats / totalFlats) * 100) : 0
  const yearTarget       = 1_030_000
  const collectedPct     = Math.min(Math.round((totalCollection / yearTarget) * 100), 100)
  const fmt              = (n: number) => '₹' + n.toLocaleString('en-IN')

  // monthStats: per-column totals shown in the heatmap header row.
  // Rules:
  //  • Only anchor rows (isAnchorMonth !== false) represent real money.
  //  • A multi-month transaction (e.g. ₹400 for Jan+Feb) contributes its FULL
  //    totalAmount to the month of the anchor row (Jan), and ₹0 to the clone
  //    months (Feb). This correctly reflects that the ₹400 was collected once.
  //  • Clone rows have amount=0 so even an unfiltered sum stays correct.
  const monthStats = useMemo(() => MONTHS.map((_, mi) => {
    const monthIdx = mi + 1
    let total = 0; let count = 0
    flats.forEach(f => {
      // Find the payment for this month — could be an anchor or a clone
      const p = f.payments.find(p => p.month === monthIdx)
      if (!p) return
      count++
      // Only add money for anchor rows; clones already carry amount=0 but
      // we guard explicitly so the intent is clear.
      if (p.isAnchorMonth !== false) total += p.amount
    })
    return { total, flats: count }
  }), [flats])

  const filtered = useMemo(() => flats.filter(f => {
    if (blockFilter !== 'All Blocks' && f.block !== blockFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return f.block.toLowerCase().includes(q) || f.flat.toLowerCase().includes(q) || f.payments.some(p => String(p.amount).includes(q))
  }), [flats, blockFilter, search])

  const Dropdown = ({ value, options, open, setOpen, onChange }: { value: string; options: string[]; open: boolean; setOpen: (v: boolean) => void; onChange: (v: string) => void }) => (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 40, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 13, fontWeight: 500, color: '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {value} <ChevronDown size={14} color="#94a3b8" />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,0.1)', minWidth: 160, overflow: 'hidden' }}>
            {options.map(o => (
              <button key={o} onClick={() => { onChange(o); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13, cursor: 'pointer', border: 'none', background: o === value ? 'rgba(22,163,74,0.06)' : '#fff', color: o === value ? '#16a34a' : '#0f172a', fontWeight: o === value ? 700 : 400 }}
                onMouseEnter={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#f8fafc' }}
                onMouseLeave={e => { if (o !== value) (e.currentTarget as HTMLElement).style.background = '#fff' }}
              >{o}</button>
            ))}
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes pulse        { 0%,100%{opacity:1}            50%{opacity:0.4}                           }
        @keyframes spin         { from{transform:rotate(0deg)} to{transform:rotate(360deg)}                }
        @keyframes fadeIn       { from{opacity:0}               to{opacity:1}                              }
        @keyframes slideInRight { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes modalIn      { from{opacity:0;transform:translate(-50%,-46%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes rowHighlight { 0%{background:#fef9c3} 100%{background:#fff}                            }
      `}</style>

      <AddPaymentModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={handlePaymentSuccess} prefillBlock={modalBlock} prefillFlat={modalFlat} existingPayments={modalExistingPayments} />

      <AddPaymentModal open={editModalOpen} onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false)
          if (editPrefillBlock && editPrefillFlat) { setHighlightedFlat(`${editPrefillBlock}-${editPrefillFlat}`); setTimeout(() => setHighlightedFlat(null), 3000) }
          setToast({ message: 'Payment updated successfully.', type: 'success' })
          loadAll()
        }}
        prefillBlock={editPrefillBlock} prefillFlat={editPrefillFlat} existingPayments={[]}
        editMode={true} editPaymentId={editPaymentId} editPrefill={editPrefill} />

      <DeleteModal open={deleteOpen} payment={deletePayment} flatLabel={deleteFlatRef ? `${deleteFlatRef.block} \u00b7 Flat ${deleteFlatRef.flat}` : ''} onClose={() => setDeleteOpen(false)} onConfirm={handleDeleteConfirm} />

      <FlatPanel open={panelOpen} flat={panelFlat} onClose={() => setPanelOpen(false)}
        onAddPayment={(block, flat, pmts) => { setPanelOpen(false); openFlatModal(block, flat, pmts) }}
        onEditPayment={(f, p)  => { setPanelOpen(false); openEditModal(f, p) }}
        onDeletePayment={(f, p) => { setPanelOpen(false); openDeleteModal(f, p) }} />

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>

        {globalError && (
          <div style={{ padding: '14px 18px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={16} color="#dc2626" />
            <span>Failed to load payment data. Check your connection and try again.</span>
            <button onClick={loadAll} style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'flex', gap: 16, width: '100%' }}>
          <KpiCard icon={<CreditCard size={18} color="#3b82f6" />} color="#3b82f6" label="Total Collection" value={fmt(totalCollection)} sub={`${collectedPct}% collected \u00b7 year 2026`} pct={collectedPct} barColor="#3b82f6" loading={allLoading} />
          <KpiCard icon={<Home size={18} color="#10b981" />} color="#10b981" label="Paid Flats" value={`${paidFlats} / ${totalFlats}`} sub={`${paidPct}% of flats paid`} pct={paidPct} barColor="#10b981" loading={allLoading} />
          <KpiCard icon={<Globe size={18} color="#8b5cf6" />} color="#8b5cf6" label="Online Collection" value={fmt(onlineCollection)} sub="of total collected" pct={onlinePct} barColor="#8b5cf6" loading={allLoading} />
          <KpiCard icon={<Wallet size={18} color="#f59e0b" />} color="#f59e0b" label="Cash Collection" value={fmt(cashCollection)} sub="of total collected" pct={cashPct} barColor="#f59e0b" loading={allLoading} />
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: 4, background: '#f1f5f9', borderRadius: 10, marginRight: 6 }}>
            <TabButton active={activeTab === 'heatmap'}  icon={<List size={14} />}     label="Heat Map"     onClick={() => setActiveTab('heatmap')} />
            <TabButton active={activeTab === 'calendar'} icon={<Calendar size={14} />} label="Calendar"     onClick={() => setActiveTab('calendar')} />
            <TabButton active={activeTab === 'recent'}   icon={<Clock size={14} />}    label="Transactions" onClick={() => setActiveTab('recent')} />
          </div>
          <Dropdown value={blockFilter} open={showBlockDrop} setOpen={setShowBlockDrop} options={['All Blocks', ...ALL_BLOCKS]} onChange={setBlockFilter} />
          <Dropdown value={fieldFilter} open={showFieldDrop} setOpen={setShowFieldDrop} options={['All Fields', 'Amount', 'Date', 'Mode']} onChange={setFieldFilter} />
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><Search size={14} color="#94a3b8" /></span>
            <input style={{ display: 'block', width: '100%', boxSizing: 'border-box', height: 40, paddingLeft: 36, paddingRight: search ? 36 : 12, border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 13, color: '#0f172a', background: '#fff', outline: 'none' }}
              placeholder="Search block, flat, or amount..." value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => ((e.currentTarget as HTMLElement).style.borderColor = '#16a34a')}
              onBlur={e  => ((e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0')} />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: 5, border: 'none', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <X size={11} color="#64748b" />
              </button>
            )}
          </div>
          <span style={{ fontSize: 13, color: '#94a3b8', whiteSpace: 'nowrap', fontWeight: 500 }}>{filtered.length} flats</span>
          <button onClick={loadAll} title="Reload payment data" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, border: '1.5px solid #e2e8f0', background: '#fff', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#f8fafc')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#fff')}>
            <RefreshCw size={15} className={allLoading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openGlobalModal}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 18px', height: 40, borderRadius: 8, background: '#16a34a', border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#15803d')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#16a34a')}>
            <Plus size={15} /> Add Payment
          </button>
        </div>

        {/* ── Heat Map Tab (original table — preserved exactly) ── */}
        {activeTab === 'heatmap' && (
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
                        <div style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>{monthStats[i].flats > 0 ? `${monthStats[i].flats}` : '0'}</div>
                      </th>
                    ))}
                    <th style={{ padding: '10px 6px', textAlign: 'right', fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase', width: '5%' }}>Total</th>
                    <th style={{ padding: '10px 4px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', width: '4%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows: React.ReactNode[] = []
                    let lastBlock = ''

                    if (globalLoading) return Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={`skel-${idx}`} style={{ background: '#fff' }}>
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}><div style={{ width: 60, height: 13, borderRadius: 4, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                        <td style={{ padding: '12px 12px', borderBottom: '1px solid #f1f5f9' }}><div style={{ width: 36, height: 13, borderRadius: 4, background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                        {MONTHS.map((_, mi) => (
                          <td key={mi} style={{ padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ width: 48, height: 14, borderRadius: 4, background: '#f1f5f9', margin: '0 auto', animation: 'pulse 1.5s ease-in-out infinite' }} />
                          </td>
                        ))}
                        <td style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}><div style={{ width: 40, height: 14, borderRadius: 4, background: '#f1f5f9', marginLeft: 'auto', animation: 'pulse 1.5s ease-in-out infinite' }} /></td>
                        <td style={{ padding: '12px 4px', borderBottom: '1px solid #f1f5f9' }} />
                      </tr>
                    ))

                    filtered.forEach(f => {
                      if (f.block !== lastBlock) {
                        lastBlock = f.block
                        const blockFlats = filtered.filter(x => x.block === f.block)
                        const blockTotal = blockFlats.reduce((s, x) => s + x.payments.filter(p => p.isAnchorMonth !== false).reduce((a, p) => a + p.amount, 0), 0)
                        const blockPaid  = blockFlats.filter(x => x.payments.length > 0).length
                        rows.push(
                          <tr key={`sep-${f.block}`} style={{ background: '#1e293b' }}>
                            <td colSpan={16} style={{ padding: '10px 16px', borderBottom: '2px solid #334155' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc', letterSpacing: '0.04em' }}>{f.block}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', background: '#334155', borderRadius: 20, padding: '2px 10px' }}>{blockFlats.length} flats</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#34d399', background: '#064e3b', borderRadius: 20, padding: '2px 10px' }}>{blockPaid} paid</span>
                                {blockTotal > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#6ee7b7', marginLeft: 'auto', marginRight: 4 }}>₹{blockTotal.toLocaleString('en-IN')}</span>}
                              </div>
                            </td>
                          </tr>
                        )
                      }
                      const total   = f.payments.filter(p => p.isAnchorMonth !== false).reduce((s, p) => s + p.amount, 0)
                      const flatKey = `${f.block}-${f.flat}`
                      rows.push(
                        <tr key={flatKey} style={{ background: '#fff', animation: highlightedFlat === flatKey ? 'rowHighlight 3s ease' : undefined }}>
                          <td style={{ padding: '8px 8px', fontSize: 11, fontWeight: 500, color: '#64748b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.block}</td>
                          <td style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{f.flat}</td>
                          {MONTHS.map((_, mi) => {
                            const p = f.payments.find(p => p.month === mi + 1)
                            // Architecture: clicking a paid cell opens the FlatPanel (navigates to parent
                            // transaction), not a month-level edit. The month is not independently editable.
                            return <PaymentCell key={mi} payment={p} onEdit={p ? () => openFlatPanel(f) : undefined} />
                          })}
                          <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: total > 0 ? '#0f172a' : '#94a3b8', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                            {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '₹0'}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', gap: 3, justifyContent: 'center' }}>
                              <button onClick={() => openFlatPanel(f)} title={`View details for ${f.block} / ${f.flat}`}
                                style={{ width: 24, height: 24, borderRadius: 5, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all 0.12s ease' }}
                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#eff6ff'; el.style.borderColor = '#93c5fd' }}
                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff'; el.style.borderColor = '#e2e8f0' }}>
                                <ChevronRight size={11} color="#64748b" />
                              </button>
                              <button onClick={() => openFlatModal(f.block, f.flat, f.payments)} title={`Add payment for ${f.block} / ${f.flat}`}
                                style={{ width: 24, height: 24, borderRadius: 5, border: '1.5px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'all 0.12s ease' }}
                                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#f0fdf4'; el.style.borderColor = '#86efac' }}
                                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = '#fff'; el.style.borderColor = '#e2e8f0' }}>
                                <Plus size={11} color="#16a34a" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })

                    if (!globalLoading && filtered.length === 0) rows.push(
                      <tr key="empty"><td colSpan={16} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8', fontSize: 14 }}>
                        {globalError ? 'Failed to load data. Please retry.' : 'No flats found matching your filters'}
                      </td></tr>
                    )
                    return rows
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Calendar Tab ── */}
        {activeTab === 'calendar' && (
          <CalendarView flats={filtered} loading={globalLoading} onFlatClick={openFlatPanel} />
        )}

        {/* ── Recent Transactions Tab ── */}
        {activeTab === 'recent' && (
          <RecentView flats={filtered} loading={globalLoading} onEdit={openEditModal} onDelete={openDeleteModal} />
        )}

      </div>
    </>
  )
}