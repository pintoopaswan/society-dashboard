'use client'
// app/(admin)/payments/page.tsx
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { CreditCard, Home, Globe, Wallet, ChevronDown, Plus, Search, X, RefreshCw, CheckCircle2, AlertCircle, Calendar, DollarSign, FileText, Loader2 } from 'lucide-react'
import { api, type PaymentHistoryEntry, type RecordPaymentByFlatPayload, type EditPaymentPayload } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

type PaymentMode = 'ONLINE' | 'CASH'

interface Payment {
  id?: string             // maintenancePayment.id
  transactionId?: string  // PaymentTransaction.id — the edit key
  month: number
  amount: number          // full transaction amount (only on anchor month)
  date: string
  billingMonth: string
  mode: PaymentMode
  notes: string | null
  paidMonths?: string[]   // all months covered by this transaction
  isAnchorMonth?: boolean // last month in paidMonths — shows amount + date
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
  // edit mode
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

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC']
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
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function normalizeBlock(raw: string): string {
  const match = raw.match(/\d+/)
  if (!match) return raw
  return `Block-${match[0]}`
}

function normalizeFlat(raw: string): string {
  const stripped = raw.includes('-') ? raw.split('-').pop()! : raw
  return String(parseInt(stripped, 10))
}

async function fetchAllPayments(): Promise<Flat[]> {
  const entries: PaymentHistoryEntry[] = await api.getPaymentHistory({ year: '2026' })

  if (entries.length > 0) {
    console.log('[PaymentsPage] API sample entry:', entries[0])
    console.log('[PaymentsPage] Total entries:', entries.length)
  }

  const map = new Map<string, Payment[]>()

  for (const entry of entries) {
    if (!entry.block || !entry.flatNumber) continue

    const block = normalizeBlock(entry.block)
    const flat  = normalizeFlat(entry.flatNumber)
    const key   = `${block}__${flat}`

    // Determine which months this transaction covers
    // New model: paidMonths[] is canonical. Fall back to [billingMonth] for legacy rows.
    const coveredMonths: string[] = (
      entry.paidMonths && entry.paidMonths.length > 0
        ? entry.paidMonths
        : entry.billingMonth ? [entry.billingMonth] : []
    )
    if (coveredMonths.length === 0) continue

    const sortedMonths = [...coveredMonths].sort()
    const anchorMonth  = sortedMonths[sortedMonths.length - 1] // last = shows ₹ + date

    const existing = map.get(key) ?? []

    for (const month of sortedMonths) {
      const [, monthStr] = month.split('-')
      const monthNum = parseInt(monthStr, 10)
      if (!monthNum) continue

      const isAnchor = month === anchorMonth

      existing.push({
        id:            entry.id,            // maintenancePayment.id (if available)
        transactionId: entry.id,            // transaction id — same for all months in group
        month:         monthNum,
        // Only the anchor month shows the real amount — others show 0 (badge only)
        amount:        isAnchor ? entry.amount : 0,
        date:          isAnchor ? fmtDate(String(entry.date)) : '',
        billingMonth:  month,
        mode:          inferMode(entry.mode, entry.notes),
        notes:         entry.notes,
        paidMonths:    sortedMonths,
        isAnchorMonth: isAnchor,
      })
    }

    map.set(key, existing)
  }

  return FLAT_STRUCTURE.map(({ block, flat }) => ({
    block,
    flat,
    payments: map.get(`${block}__${flat}`) ?? [],
    loading: false,
    error: false,
  }))
}

// ─── Canonical flat structure ─────────────────────────────────────────────────

const ALL_BLOCKS = ['Block-1','Block-2','Block-3','Block-4','Block-5','Block-6','Block-7','Block-8','Block-9']
const FLOORS = [1, 2, 3, 4, 5, 6]
const FLATS_PER_FLOOR = [1, 2, 3, 4, 5, 6, 7, 8]

const FLAT_STRUCTURE: { block: string; flat: string }[] = ALL_BLOCKS.flatMap(block =>
  FLOORS.flatMap(floor =>
    FLATS_PER_FLOOR.map(unit => ({ block, flat: String(floor * 100 + unit) }))
  )
)

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }: { message: string; type: 'success' | 'error'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000)
    return () => clearTimeout(t)
  }, [onDone])

  const isSuccess = type === 'success'
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 20px', borderRadius: 12,
      background: isSuccess ? '#f0fdf4' : '#fef2f2',
      border: `1.5px solid ${isSuccess ? '#86efac' : '#fca5a5'}`,
      boxShadow: '0 8px 32px rgba(15,23,42,0.14)',
      maxWidth: 380, animation: 'slideInRight 0.25s ease',
    }}>
      {isSuccess
        ? <CheckCircle2 size={18} color="#16a34a" />
        : <AlertCircle size={18} color="#dc2626" />
      }
      <span style={{ fontSize: 13, fontWeight: 600, color: isSuccess ? '#15803d' : '#b91c1c' }}>{message}</span>
      <button onClick={onDone} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
        <X size={14} color={isSuccess ? '#86efac' : '#fca5a5'} />
      </button>
    </div>
  )
}

// ─── Add Payment Modal ────────────────────────────────────────────────────────

function AddPaymentModal({ open, onClose, onSuccess, prefillBlock, prefillFlat, existingPayments = [], editMode = false, editPaymentId, editPrefill }: AddPaymentModalProps) {
  const today = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  const defaultDateStr = `${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}T${pad2(today.getHours())}:${pad2(today.getMinutes())}`

  const [block, setBlock] = useState(prefillBlock ?? '')
  const [flat, setFlat] = useState(prefillFlat ?? '')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<PaymentMode | ''>('')
  const [paymentDate, setPaymentDate] = useState(defaultDateStr)
  const [lateFee, setLateFee] = useState('')
  const [selectedMonths, setSelectedMonths] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSummary, setShowSummary] = useState(false)
  const [flatFlats, setFlatFlats] = useState<string[]>([])
  const [showBlockDrop, setShowBlockDrop] = useState(false)
  const [showFlatDrop, setShowFlatDrop] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setBlock(prefillBlock ?? '')
      setFlat(prefillFlat ?? '')
      setErrors({})
      setShowSummary(false)
      if (editMode && editPrefill) {
        setAmount(String(editPrefill.amount))
        setMode(editPrefill.mode)
        setLateFee(editPrefill.lateFee > 0 ? String(editPrefill.lateFee) : '')
        setNotes(editPrefill.notes ?? '')
        // Format paidAt to datetime-local string
        const d = new Date(editPrefill.paidAt)
        const pad = (n: number) => String(n).padStart(2, '0')
        setPaymentDate(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
        setSelectedMonths([editPrefill.billingMonth])
      } else {
        setAmount('')
        setMode('')
        setPaymentDate(defaultDateStr)
        setLateFee('')
        setSelectedMonths([])
        setNotes('')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefillBlock, prefillFlat, editMode])

  // Derive flats list for chosen block
  useEffect(() => {
    if (block) {
      const flatsInBlock = FLAT_STRUCTURE.filter(f => f.block === block).map(f => f.flat)
      setFlatFlats(flatsInBlock)
      if (prefillFlat) setFlat(prefillFlat)
      else if (!flatsInBlock.includes(flat)) setFlat('')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block])

  // Paid months for selected flat
  const paidMonthKeys = useMemo(() => {
    return new Set(existingPayments.map(p => p.billingMonth))
  }, [existingPayments])

  // Build month options for current year (2026)
  const monthOptions = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const monthNum = i + 1
      const key = `2026-${pad2(monthNum)}`
      return {
        key,
        label: `${MONTH_LABELS[i]} 2026`,
        paid: paidMonthKeys.has(key),
      }
    })
  }, [paidMonthKeys])

  const toggleMonth = (key: string, paid: boolean) => {
    if (paid) return
    setSelectedMonths(prev =>
      prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key]
    )
    setErrors(e => ({ ...e, months: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!block) e.block = 'Select a block'
    if (!flat) e.flat = 'Select a flat'
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) e.amount = 'Enter a valid amount greater than zero'
    if (!mode) e.mode = 'Select payment mode'
    if (!paymentDate) e.paymentDate = 'Select payment date & time'
    if (selectedMonths.length === 0) e.months = 'Select at least one billing month'
    return e
  }

  const handleReview = () => {
    const e = validate()
    if (Object.keys(e).length > 0) { setErrors(e); return }
    setErrors({})
    setShowSummary(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setErrors({})
    try {
      const paidAt = new Date(paymentDate).toISOString().replace('Z', '+05:30')

      if (editMode && editPaymentId) {
        // ── Edit mode: PATCH only the changed fields ───────────────────────
        const payload: EditPaymentPayload = {
          mode:    mode as EditPaymentPayload['mode'],
          paidAt,
          amount:  Number(amount),
          lateFee: lateFee && Number(lateFee) > 0 ? Number(lateFee) : 0,
          notes:   notes || undefined,
        }
        await api.editPayment(editPaymentId, payload)
      } else if (editMode && !editPaymentId) {
        throw new Error('Payment ID not available — please refresh and try again.')
      } else {
        // ── Create mode: POST record-by-flat ───────────────────────────────
        const sortedMonths = [...selectedMonths].sort()
        const payload: RecordPaymentByFlatPayload = {
          blockName:    block.toUpperCase(),
          flatNumber:   flat,
          billingMonth: sortedMonths,
          amount:       Number(amount),
          mode:         mode as 'ONLINE' | 'CASH',
          paidAt,
          notes:        notes || undefined,
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

  const selectedMonthLabels = selectedMonths
    .sort()
    .map(k => {
      const idx = parseInt(k.split('-')[1], 10) - 1
      return MONTH_LABELS[idx]
    })

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.18s ease',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', zIndex: 1001,
        top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 560,
        maxHeight: '92vh',
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 24px 80px rgba(15,23,42,0.22)',
        display: 'flex', flexDirection: 'column',
        animation: 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 18px',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#16a34a18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={18} color="#16a34a" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                {editMode ? 'Edit Payment' : 'Record Payment'}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>
                {prefillBlock && prefillFlat
                  ? `${prefillBlock} · Flat ${prefillFlat}`
                  : editMode ? 'Update payment details below' : 'Select flat and fill payment details'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0',
            background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}>
            <X size={15} color="#64748b" />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>

          {showSummary ? (
            /* ── Payment Summary ── */
            <div>
              <p style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Review Payment
              </p>
              <div style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                {([
                  ['Block', block],
                  ['Flat', flat],
                  ['Months', selectedMonthLabels.join(', ')],
                  ['Amount', `₹${Number(amount).toLocaleString('en-IN')}`],
                  ['Mode', mode],
                  ...(lateFee && Number(lateFee) > 0 ? [['Late Fee', `₹${Number(lateFee).toLocaleString('en-IN')}`]] : []),
                  ['Date', new Date(paymentDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })],
                  ...(notes ? [['Notes', notes]] : []),
                ] as [string, string][]).map(([label, value], i, arr) => (
                  <div key={label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    padding: '11px 16px',
                    borderBottom: i < arr.length - 1 ? '1px solid #e2e8f0' : 'none',
                  }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, minWidth: 80 }}>{label}</span>
                    <span style={{ fontSize: 13, color: '#0f172a', fontWeight: 700, textAlign: 'right', maxWidth: 280 }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Selected months chips in summary */}
              <div style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {selectedMonths.sort().map(k => {
                  const idx = parseInt(k.split('-')[1], 10) - 1
                  return (
                    <span key={k} style={{
                      padding: '4px 10px', borderRadius: 20,
                      background: '#16a34a14', color: '#15803d',
                      fontSize: 12, fontWeight: 700,
                      border: '1px solid #86efac',
                    }}>
                      ✓ {MONTH_LABELS[idx]} 2026
                    </span>
                  )
                })}
              </div>

              {errors.submit && (
                <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#b91c1c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={14} color="#dc2626" /> {errors.submit}
                </div>
              )}
            </div>
          ) : (
            /* ── Form ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Block + Flat */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ModalField label="Block" error={errors.block}>
                  {prefillBlock ? (
                    <div style={lockedFieldStyle}>{prefillBlock}</div>
                  ) : (
                    <ModalSelect
                      value={block || 'Select Block'}
                      open={showBlockDrop}
                      setOpen={setShowBlockDrop}
                      options={ALL_BLOCKS}
                      onChange={v => { setBlock(v); setErrors(e => ({...e, block:''})) }}
                      placeholder="Select Block"
                      hasError={!!errors.block}
                    />
                  )}
                </ModalField>

                <ModalField label="Flat Number" error={errors.flat}>
                  {prefillFlat ? (
                    <div style={lockedFieldStyle}>{prefillFlat}</div>
                  ) : (
                    <ModalSelect
                      value={flat || 'Select Flat'}
                      open={showFlatDrop}
                      setOpen={setShowFlatDrop}
                      options={flatFlats}
                      onChange={v => { setFlat(v); setErrors(e => ({...e, flat:''})) }}
                      placeholder={block ? 'Select Flat' : 'Select Block first'}
                      disabled={!block}
                      hasError={!!errors.flat}
                    />
                  )}
                </ModalField>
              </div>

              {/* Amount + Mode */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ModalField label="Payment Amount (₹)" error={errors.amount}>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>₹</span>
                    <input
                      type="number"
                      min="1"
                      value={amount}
                      onChange={e => { setAmount(e.target.value); setErrors(er => ({...er, amount:''})) }}
                      placeholder="0"
                      style={{
                        ...inputStyle,
                        paddingLeft: 28,
                        borderColor: errors.amount ? '#fca5a5' : '#e2e8f0',
                      }}
                    />
                  </div>
                </ModalField>

                <ModalField label="Payment Mode" error={errors.mode}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['ONLINE', 'CASH'] as PaymentMode[]).map(m => (
                      <button
                        key={m}
                        onClick={() => { setMode(m); setErrors(e => ({...e, mode:''})) }}
                        style={{
                          flex: 1, height: 40, borderRadius: 8, border: `1.5px solid`,
                          borderColor: mode === m ? (m === 'ONLINE' ? '#7c3aed' : '#f59e0b') : errors.mode ? '#fca5a5' : '#e2e8f0',
                          background: mode === m ? (m === 'ONLINE' ? '#7c3aed0f' : '#f59e0b0f') : '#fff',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          color: mode === m ? (m === 'ONLINE' ? '#7c3aed' : '#d97706') : '#64748b',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {m === 'ONLINE' ? '🌐 ONLINE' : '💵 CASH'}
                      </button>
                    ))}
                  </div>
                </ModalField>
              </div>

              {/* Payment Date */}
              <ModalField label="Payment Date & Time" error={errors.paymentDate}>
                <input
                  type="datetime-local"
                  value={paymentDate}
                  onChange={e => { setPaymentDate(e.target.value); setErrors(er => ({...er, paymentDate:''})) }}
                  style={{ ...inputStyle, borderColor: errors.paymentDate ? '#fca5a5' : '#e2e8f0' }}
                />
              </ModalField>

              {/* Late Fee */}
              <ModalField label="Late Fee (Optional)">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>₹</span>
                  <input
                    type="number"
                    min="0"
                    value={lateFee}
                    onChange={e => setLateFee(e.target.value)}
                    placeholder="0"
                    style={{ ...inputStyle, paddingLeft: 28 }}
                  />
                </div>
              </ModalField>

              {/* Billing Months — locked in edit mode, multi-select in create mode */}
              {editMode ? (
                <ModalField label="Billing Month">
                  <div style={{ ...lockedFieldStyle, gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#16a34a' }}>✓</span>
                    <span>{editPrefill?.billingMonth
                      ? `${MONTH_LABELS[parseInt(editPrefill.billingMonth.split('-')[1], 10) - 1]} ${editPrefill.billingMonth.split('-')[0]}`
                      : '—'}</span>
                    <span style={{ marginLeft: 4, fontSize: 11, color: '#94a3b8' }}>(cannot change month on edit)</span>
                  </div>
                </ModalField>
              ) : (
                <ModalField label={`Billing Months${selectedMonths.length > 0 ? ` · ${selectedMonths.length} Selected` : ''}`} error={errors.months}>
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
                  padding: '12px', borderRadius: 10,
                  border: `1.5px solid ${errors.months ? '#fca5a5' : '#e2e8f0'}`,
                  background: '#fafbfc',
                }}>
                  {monthOptions.map(({ key, label, paid }) => {
                    const selected = selectedMonths.includes(key)
                    return (
                      <button
                        key={key}
                        onClick={() => toggleMonth(key, paid)}
                        title={paid ? 'Payment already recorded for this month' : undefined}
                        disabled={paid}
                        style={{
                          padding: '7px 6px', borderRadius: 7,
                          border: `1.5px solid ${paid ? '#e2e8f0' : selected ? '#16a34a' : '#e2e8f0'}`,
                          background: paid ? '#f8fafc' : selected ? '#f0fdf4' : '#fff',
                          fontSize: 11, fontWeight: 600, cursor: paid ? 'not-allowed' : 'pointer',
                          color: paid ? '#cbd5e1' : selected ? '#15803d' : '#475569',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          transition: 'all 0.12s ease',
                          position: 'relative',
                          opacity: paid ? 0.7 : 1,
                        }}
                      >
                        {paid ? (
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>✓</span>
                        ) : selected ? (
                          <span style={{ fontSize: 9, color: '#16a34a' }}>✓</span>
                        ) : null}
                        {label}
                        {paid && (
                          <span style={{
                            position: 'absolute', bottom: -1, left: '50%', transform: 'translateX(-50%)',
                            fontSize: 7, color: '#94a3b8', whiteSpace: 'nowrap',
                            fontWeight: 500,
                          }}>Paid</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {/* Selected chips */}
                {selectedMonths.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                    {selectedMonths.sort().map(k => {
                      const idx = parseInt(k.split('-')[1], 10) - 1
                      return (
                        <span key={k} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px 3px 10px', borderRadius: 20,
                          background: '#16a34a14', color: '#15803d',
                          fontSize: 11, fontWeight: 700,
                          border: '1px solid #86efac',
                        }}>
                          {MONTH_LABELS[idx]} 2026
                          <button
                            onClick={() => setSelectedMonths(m => m.filter(x => x !== k))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginLeft: 2 }}
                          >
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
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Collected at gate, receipt given manually"
                  rows={2}
                  style={{
                    ...inputStyle,
                    height: 'auto', resize: 'none', lineHeight: 1.5, paddingTop: 10, paddingBottom: 10,
                  }}
                />
              </ModalField>

            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          flexShrink: 0,
          background: '#fafbfc',
        }}>
          {showSummary ? (
            <>
              <button
                onClick={() => setShowSummary(false)}
                style={{ ...btnSecondaryStyle }}
                disabled={submitting}
              >
                ← Edit
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  ...btnPrimaryStyle,
                  background: submitting ? '#86efac' : '#16a34a',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {submitting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</> : editMode ? '✓ Update Payment' : `✓ Confirm & Save`}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} style={btnSecondaryStyle}>Cancel</button>
              <button onClick={handleReview} style={{ ...btnPrimaryStyle, background: '#16a34a' }}>
                Review Payment →
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Shared mini-components for modal ────────────────────────────────────────

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
  fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer',
  background: '#7c3aed',
}

const btnSecondaryStyle: React.CSSProperties = {
  height: 40, padding: '0 16px', borderRadius: 8,
  border: '1.5px solid #e2e8f0', background: '#fff',
  fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer',
}

function ModalField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>{error}</span>}
    </div>
  )
}

function ModalSelect({ value, open, setOpen, options, onChange, placeholder, disabled, hasError }: {
  value: string; open: boolean; setOpen: (v: boolean) => void; options: string[]
  onChange: (v: string) => void; placeholder?: string; disabled?: boolean; hasError?: boolean
}) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
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
            boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
            maxHeight: 200, overflowY: 'auto',
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
              >
                {o}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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

function PaymentCell({ payment, loading, onEdit }: { payment?: Payment; loading?: boolean; onEdit?: () => void }) {
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
  const color    = isOnline ? '#059669' : '#2563eb'

  // Non-anchor covered month — show a green badge only, no amount/date
  // Clicking still opens the same transaction editor
  if (!payment.isAnchorMonth) {
    return (
      <td
        onClick={onEdit}
        title={`Covered by transaction on ${payment.paidMonths?.join(', ')} — click to edit`}
        style={{
          padding: '6px 2px', textAlign: 'center', borderBottom: '1px solid #f1f5f9',
          background: '#f0fdf4', verticalAlign: 'middle',
          cursor: onEdit ? 'pointer' : 'default',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={e => { if (onEdit) (e.currentTarget as HTMLElement).style.background = '#dcfce7' }}
        onMouseLeave={e => { if (onEdit) (e.currentTarget as HTMLElement).style.background = '#f0fdf4' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: 13, color: '#16a34a' }}>✓</span>
          <span style={{
            fontSize: 8, fontWeight: 700, color, background: color + '14',
            borderRadius: 4, padding: '1px 5px',
          }}>PAID</span>
        </div>
      </td>
    )
  }

  // Anchor month — shows full amount, date, mode, paidMonths count
  const coveredCount = payment.paidMonths?.length ?? 1
  return (
    <td
      onClick={onEdit}
      title="Click to edit this payment"
      style={{
        padding: '6px 2px', textAlign: 'center', borderBottom: '1px solid #f1f5f9',
        background: '#f0fdf4', verticalAlign: 'top',
        cursor: onEdit ? 'pointer' : 'default',
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={e => { if (onEdit) (e.currentTarget as HTMLElement).style.background = '#dcfce7' }}
      onMouseLeave={e => { if (onEdit) (e.currentTarget as HTMLElement).style.background = '#f0fdf4' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color, whiteSpace: 'nowrap' }}>
          ₹{payment.amount.toLocaleString('en-IN')}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8' }}>{payment.date}</span>
        {coveredCount > 1 && (
          <span style={{
            fontSize: 8, fontWeight: 700, color: '#7c3aed',
            background: '#7c3aed14', borderRadius: 4, padding: '1px 5px',
            whiteSpace: 'nowrap',
          }}>
            {coveredCount} months
          </span>
        )}
        <span style={{ fontSize: 9, fontWeight: 700, color, background: color + '14', borderRadius: 4, padding: '1px 5px' }}>
          {payment.mode}
        </span>
        {onEdit && (
          <span style={{ fontSize: 8, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>✎ edit</span>
        )}
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

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalBlock, setModalBlock] = useState<string | undefined>()
  const [modalFlat, setModalFlat] = useState<string | undefined>()
  const [modalExistingPayments, setModalExistingPayments] = useState<Payment[]>([])
  const [highlightedFlat, setHighlightedFlat] = useState<string | null>(null)

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editPaymentId, setEditPaymentId] = useState<string | undefined>()
  const [editPrefillBlock, setEditPrefillBlock] = useState<string | undefined>()
  const [editPrefillFlat, setEditPrefillFlat] = useState<string | undefined>()
  const [editPrefill, setEditPrefill] = useState<{
    amount: number; lateFee: number; mode: PaymentMode
    paidAt: string; notes: string; billingMonth: string
  } | undefined>()

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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

  // Open modal globally (no prefill)
  const openGlobalModal = () => {
    setModalBlock(undefined)
    setModalFlat(undefined)
    setModalExistingPayments([])
    setModalOpen(true)
  }

  // Open modal from a flat row
  const openFlatModal = (block: string, flat: string, payments: Payment[]) => {
    setModalBlock(block)
    setModalFlat(flat)
    setModalExistingPayments(payments)
    setModalOpen(true)
  }

  // Open edit modal from clicking any paid cell — always loads the full transaction
  const openEditModal = (f: Flat, payment: Payment) => {
    // Use transactionId as the edit key — same for all months in a group
    setEditPaymentId(payment.transactionId ?? payment.id)
    setEditPrefillBlock(f.block)
    setEditPrefillFlat(f.flat)
    setEditPrefill({
      amount:       payment.amount,
      lateFee:      0,
      mode:         payment.mode,
      paidAt:       payment.date
                      ? (() => { const [d,m,y] = payment.date.split('/'); return `${y}-${m}-${d}T10:00` })()
                      : new Date().toISOString(),
      notes:        payment.notes ?? '',
      billingMonth: payment.billingMonth,
    })
    setEditModalOpen(true)
  }

  const handlePaymentSuccess = async () => {
    setModalOpen(false)
    const key = modalBlock && modalFlat ? `${modalBlock}-${modalFlat}` : null
    const months = modalFlat ? '?' : '?'
    setToast({ message: `Payment recorded successfully.`, type: 'success' })
    if (key) {
      setHighlightedFlat(key)
      setTimeout(() => setHighlightedFlat(null), 3000)
    }
    await loadAll()
  }

  // Derived KPI values
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

  const monthStats = useMemo(() => MONTHS.map((_, mi) => {
    const monthIdx = mi + 1
    let total = 0; let count = 0
    flats.forEach(f => {
      const p = f.payments.find(p => p.month === monthIdx)
      if (p) { total += p.amount; count++ }
    })
    return { total, flats: count }
  }), [flats])

  const filtered = useMemo(() => flats.filter(f => {
    if (blockFilter !== 'All Blocks' && f.block !== blockFilter) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    if (f.block.toLowerCase().includes(q)) return true
    if (f.flat.toLowerCase().includes(q)) return true
    if (f.payments.some(p => String(p.amount).includes(q))) return true
    return false
  }), [flats, blockFilter, search])

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

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideInRight { from{transform:translateX(40px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes modalIn { from{opacity:0;transform:translate(-50%,-46%) scale(0.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
        @keyframes rowHighlight { 0%{background:#fef9c3} 100%{background:#fff} }
      `}</style>

      {/* Add Payment Modal */}
      <AddPaymentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handlePaymentSuccess}
        prefillBlock={modalBlock}
        prefillFlat={modalFlat}
        existingPayments={modalExistingPayments}
      />

      {/* Edit Payment Modal */}
      <AddPaymentModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSuccess={() => {
          setEditModalOpen(false)
          if (editPrefillBlock && editPrefillFlat) {
            setHighlightedFlat(`${editPrefillBlock}-${editPrefillFlat}`)
            setTimeout(() => setHighlightedFlat(null), 3000)
          }
          setToast({ message: 'Payment updated successfully.', type: 'success' })
          loadAll()
        }}
        prefillBlock={editPrefillBlock}
        prefillFlat={editPrefillFlat}
        existingPayments={[]}
        editMode={true}
        editPaymentId={editPaymentId}
        editPrefill={editPrefill}
      />

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>

        {/* Error banner */}
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

        {/* KPI Cards */}
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

        {/* Filters bar */}
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

          {/* Add Payment Button — opens modal */}
          <button
            onClick={openGlobalModal}
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

        {/* Table */}
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
                  <th style={{ padding: '10px 6px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', width: '3%' }}></th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows: React.ReactNode[] = []
                  let lastBlock = ''
                  filtered.forEach((f, idx) => {
                    if (f.block !== lastBlock) {
                      lastBlock = f.block
                      const blockFlats = filtered.filter(x => x.block === f.block)
                      const blockTotal = blockFlats.reduce((s, x) => s + x.payments.reduce((a, p) => a + p.amount, 0), 0)
                      const blockPaid  = blockFlats.filter(x => x.payments.length > 0).length
                      rows.push(
                        <tr key={`sep-${f.block}`} style={{ background: '#1e293b' }}>
                          <td colSpan={16} style={{ padding: '10px 16px', borderBottom: '2px solid #334155' }}>
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
                    const total = f.payments.reduce((s, p) => s + p.amount, 0)
                    const flatKey = `${f.block}-${f.flat}`
                    const isHighlighted = highlightedFlat === flatKey
                    rows.push(
                      <tr
                        key={flatKey}
                        style={{
                          background: '#fff',
                          animation: isHighlighted ? 'rowHighlight 3s ease' : undefined,
                        }}
                      >
                        <td style={{ padding: '8px 8px', fontSize: 11, fontWeight: 500, color: '#64748b', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.block}</td>
                        <td style={{ padding: '8px 6px', fontSize: 11, fontWeight: 700, color: '#0f172a', borderBottom: '1px solid #f1f5f9' }}>{f.flat}</td>
                        {MONTHS.map((_, mi) => {
                          const p = f.payments.find(p => p.month === mi + 1)
                          return <PaymentCell key={mi} payment={p} onEdit={p ? () => openEditModal(f, p) : undefined} />
                        })}
                        <td style={{ padding: '8px 6px', textAlign: 'right', fontSize: 11, fontWeight: 700, color: total > 0 ? '#0f172a' : '#94a3b8', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                          {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '₹0'}
                        </td>
                        {/* Per-row add payment button */}
                        <td style={{ padding: '6px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                          <button
                            onClick={() => openFlatModal(f.block, f.flat, f.payments)}
                            title={`Add payment for ${f.block} / ${f.flat}`}
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              border: '1.5px solid #e2e8f0', background: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', padding: 0, transition: 'all 0.12s ease',
                            }}
                            onMouseEnter={e => {
                              const el = e.currentTarget as HTMLElement
                              el.style.background = '#f0fdf4'
                              el.style.borderColor = '#86efac'
                            }}
                            onMouseLeave={e => {
                              const el = e.currentTarget as HTMLElement
                              el.style.background = '#fff'
                              el.style.borderColor = '#e2e8f0'
                            }}
                          >
                            <Plus size={12} color="#16a34a" />
                          </button>
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
                      <td style={{ padding: '12px 4px', borderBottom: '1px solid #f1f5f9' }} />
                    </tr>
                  ))
                )}
                {!globalLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={16} style={{ textAlign: 'center', padding: '48px 16px', color: '#94a3b8', fontSize: 14 }}>
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