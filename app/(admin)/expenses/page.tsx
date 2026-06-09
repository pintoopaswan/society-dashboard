'use client'
// app/(admin)/expenses/page.tsx
import { useEffect, useState } from 'react'
import { api, Expense } from '@/lib/api'
import { Plus, RefreshCw, X, TrendingDown, Receipt } from 'lucide-react'

const CATEGORIES = ['MAINTENANCE', 'UTILITIES', 'SECURITY', 'REPAIR', 'SALARY', 'MISC']

const CAT_COLORS: Record<string, { badge: string; bg: string; text: string; dot: string }> = {
  MAINTENANCE: { badge: 'badge-pending',  bg: '#fff7ed', text: '#c2410c', dot: '#fb923c' },
  UTILITIES:   { badge: 'badge-rented',   bg: '#eff6ff', text: '#1d4ed8', dot: '#60a5fa' },
  SECURITY:    { badge: 'badge-owner',    bg: '#f0fdf4', text: '#15803d', dot: '#4ade80' },
  REPAIR:      { badge: 'badge-overdue',  bg: '#fef2f2', text: '#b91c1c', dot: '#f87171' },
  SALARY:      { badge: 'badge-paid',     bg: '#faf5ff', text: '#7e22ce', dot: '#c084fc' },
  MISC:        { badge: 'badge-vacant',   bg: '#f8fafc', text: '#475569', dot: '#94a3b8' },
}

const CAT_LABELS: Record<string, string> = {
  MAINTENANCE: 'Maintenance',
  UTILITIES: 'Utilities',
  SECURITY: 'Security',
  REPAIR: 'Repair',
  SALARY: 'Salary',
  MISC: 'Misc',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState({
    category: 'MAINTENANCE', description: '', amount: '',
    vendor: '', expenseDate: new Date().toISOString().slice(0, 10),
  })

  const load = async () => {
    setLoading(true)
    try { setExpenses(await api.getExpenses()) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    if (!form.description || !form.amount) { setError('Description and amount required'); return }
    setSaving(true); setError('')
    try {
      await api.addExpense({ ...form, amount: parseFloat(form.amount) } as any)
      setShowAdd(false)
      setForm({ category: 'MAINTENANCE', description: '', amount: '', vendor: '', expenseDate: new Date().toISOString().slice(0, 10) })
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Receipt size={20} color="#64748b" />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>Expenses</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0' }}>
              ₹{total.toLocaleString()} total · {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '16px', paddingRight: '16px' }}
        >
          <Plus size={15} /> Add Expense
        </button>
      </div>

      {/* ── Category summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
        {CATEGORIES.map(cat => {
          const c = CAT_COLORS[cat]
          const catTotal = expenses
            .filter(e => e.category === cat)
            .reduce((s, e) => s + Number(e.amount), 0)
          return (
            <div
              key={cat}
              className="card"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '14px 16px', gap: '8px', minWidth: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: c.text, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {CAT_LABELS[cat]}
                </span>
              </div>
              <p style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1 }}>
                ₹{catTotal.toLocaleString()}
              </p>
            </div>
          )
        })}
      </div>

      {/* ── Expense table ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px', color: '#94a3b8', gap: '8px' }}>
          <RefreshCw size={18} className="animate-spin" /> Loading expenses…
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header bar */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>All Transactions</span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{expenses.length} records</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {[
                    { label: 'Date',        align: 'left'  },
                    { label: 'Category',    align: 'left'  },
                    { label: 'Description', align: 'left'  },
                    { label: 'Vendor',      align: 'left'  },
                    { label: 'Amount',      align: 'right' },
                  ].map(col => (
                    <th key={col.label} style={{
                      padding: '10px 20px',
                      textAlign: col.align as any,
                      fontSize: '11px', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      color: '#94a3b8', whiteSpace: 'nowrap',
                      borderBottom: '1px solid #f1f5f9',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, idx) => {
                  const c = CAT_COLORS[e.category] ?? CAT_COLORS.MISC
                  return (
                    <tr
                      key={e.id}
                      style={{
                        borderBottom: idx < expenses.length - 1 ? '1px solid #f8fafc' : 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={ev => (ev.currentTarget.style.background = '#fafbfc')}
                      onMouseLeave={ev => (ev.currentTarget.style.background = '')}
                    >
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                        {new Date(e.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                          color: c.text, background: c.bg,
                          padding: '3px 8px', borderRadius: '5px', whiteSpace: 'nowrap',
                        }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: c.dot }} />
                          {CAT_LABELS[e.category]}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#374151', maxWidth: '260px' }}>
                        {e.description}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: '#94a3b8' }}>
                        {e.vendor ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                          −₹{Number(e.amount).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '56px 16px', color: '#cbd5e1' }}>
                      <TrendingDown size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontSize: '14px', color: '#94a3b8' }}>No expenses recorded yet</p>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#cbd5e1' }}>Click "Add Expense" to get started</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add expense modal ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div
            style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
            onClick={() => setShowAdd(false)}
          />
          <div
            className="bg-surface-card"
            style={{
              position: 'relative', width: '100%', maxWidth: '460px',
              borderRadius: '16px', padding: '28px',
              boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
              border: '1px solid #f1f5f9',
              display: 'flex', flexDirection: 'column', gap: '20px',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Add Expense</h2>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0' }}>Record a new expense entry</p>
              </div>
              <button
                onClick={() => setShowAdd(false)}
                style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={15} />
              </button>
            </div>

            {error && (
              <div style={{ fontSize: '13px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px' }}>
                {error}
              </div>
            )}

            {/* Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Category</label>
                  <select className="input" style={{ width: '100%', marginTop: '5px' }}
                    value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Description <span style={{ color: '#f87171' }}>*</span></label>
                  <input className="input" style={{ width: '100%', marginTop: '5px' }}
                    placeholder="e.g. Generator servicing"
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>

                <div>
                  <label style={labelStyle}>Amount (₹) <span style={{ color: '#f87171' }}>*</span></label>
                  <input className="input" style={{ width: '100%', marginTop: '5px' }}
                    placeholder="0" type="number" min="0"
                    value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>

                <div>
                  <label style={labelStyle}>Date</label>
                  <input className="input" style={{ width: '100%', marginTop: '5px' }}
                    type="date" value={form.expenseDate}
                    onChange={e => setForm({ ...form, expenseDate: e.target.value })} />
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Vendor <span style={{ color: '#cbd5e1', fontWeight: 400 }}>(optional)</span></label>
                  <input className="input" style={{ width: '100%', marginTop: '5px' }}
                    placeholder="e.g. ABC Electricals"
                    value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
              <button onClick={() => setShowAdd(false)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
                {saving ? 'Saving…' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: '#64748b',
  letterSpacing: '0.01em',
}