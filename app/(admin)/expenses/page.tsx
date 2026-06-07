'use client'
// app/(admin)/expenses/page.tsx
import { useEffect, useState } from 'react'
import { api, Expense } from '@/lib/api'
import { Receipt, Plus, RefreshCw, X, TrendingDown } from 'lucide-react'

const CATEGORIES = ['MAINTENANCE','UTILITIES','SECURITY','REPAIR','SALARY','MISC']

const CAT_COLORS: Record<string, string> = {
  MAINTENANCE: 'badge-pending',
  UTILITIES:   'badge-rented',
  SECURITY:    'badge-owner',
  REPAIR:      'badge-overdue',
  SALARY:      'badge-paid',
  MISC:        'badge-vacant',
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
      await api.addExpense({
        ...form,
        amount: parseFloat(form.amount),
      } as any)
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
      <div className="flex items-center justify-between fade-up">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Total: ₹{total.toLocaleString()} across {expenses.length} entries
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Expense
        </button>
      </div>

      {/* Category summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 fade-up fade-up-1">
        {CATEGORIES.map(cat => {
          const catTotal = expenses
            .filter(e => e.category === cat)
            .reduce((s, e) => s + Number(e.amount), 0)
          return (
            <div key={cat} className="card text-center">
              <span className={`badge ${CAT_COLORS[cat]} mb-2`}>{cat}</span>
              <p className="text-slate-900 font-bold text-sm">₹{catTotal.toLocaleString()}</p>
            </div>
          )
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-500">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="card fade-up fade-up-2">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-surface-border">
                  <th className="text-left px-5 pb-3">Date</th>
                  <th className="text-left px-3 pb-3">Category</th>
                  <th className="text-left px-3 pb-3">Description</th>
                  <th className="text-left px-3 pb-3 hidden md:table-cell">Vendor</th>
                  <th className="text-right px-5 pb-3">Amount</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id} className="border-b border-surface-border/50 hover:bg-surface-border/20">
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(e.expenseDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge ${CAT_COLORS[e.category]}`}>{e.category}</span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{e.description}</td>
                    <td className="px-3 py-3 text-slate-500 hidden md:table-cell">{e.vendor ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-red-400 font-semibold">
                      −₹{Number(e.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-slate-500">
                      <TrendingDown size={28} className="mx-auto mb-2 opacity-30" />
                      No expenses recorded
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add expense modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Add Expense</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <select className="input" value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="input" placeholder="Description *"
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input className="input" placeholder="Amount (₹) *" type="number"
                value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
              <input className="input" placeholder="Vendor name"
                value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} />
              <input className="input" type="date"
                value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAdd(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="btn-primary flex-1">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
