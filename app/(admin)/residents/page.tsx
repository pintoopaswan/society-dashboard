'use client'
// app/(admin)/residents/page.tsx
import { useEffect, useState } from 'react'
import { api, Person } from '@/lib/api'
import { Users, Search, Plus, Phone, Home, RefreshCw, X } from 'lucide-react'

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Person[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ name: '', phone: '', email: '', altPhone: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = async (q = '') => {
    setLoading(true)
    try { setResidents(await api.getResidents(q)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (v.length >= 2 || v.length === 0) load(v)
  }

  const handleAdd = async () => {
    if (!form.name || !form.phone) { setError('Name and phone are required'); return }
    setSaving(true); setError('')
    try {
      await api.addResident(form)
      setShowAdd(false)
      setForm({ name: '', phone: '', email: '', altPhone: '' })
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = residents.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone.includes(search)
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between fade-up">
        <div>
          <h1 className="page-title">Residents</h1>
          <p className="text-slate-500 text-sm mt-0.5">{residents.length} persons registered</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Search */}
      <div className="relative fade-up fade-up-1">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          className="input pl-10"
          placeholder="Search by name or phone…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-500">
          <RefreshCw size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <div className="space-y-2 fade-up fade-up-2">
          {filtered.map(r => (
            <div key={r.id} className="card hover:border-slate-500 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-display font-bold text-sm flex-shrink-0">
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                      <Phone size={11} /> {r.phone}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {r.ownerships && r.ownerships.length > 0 && (
                    <div className="flex items-center gap-1 text-violet-400">
                      <Home size={11} />
                      {r.ownerships.map(o => `${o.flat.block.name}-${o.flat.flatNumber}`).join(', ')}
                    </div>
                  )}
                  {r.tenancies && r.tenancies.length > 0 && (
                    <div className="flex items-center gap-1 text-blue-400 mt-0.5">
                      <Home size={11} />
                      {r.tenancies.map(t => `${t.flat.block.name}-${t.flat.flatNumber}`).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card text-center py-12 text-slate-500">
              <Users size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No residents found</p>
            </div>
          )}
        </div>
      )}

      {/* Add resident modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={() => setShowAdd(false)} />
          <div className="relative w-full max-w-md bg-surface-card border border-surface-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900">Add Resident</h2>
              <button onClick={() => setShowAdd(false)} className="text-slate-500 hover:text-slate-900">
                <X size={18} />
              </button>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-500/10 rounded-xl px-3 py-2">{error}</p>}

            <div className="space-y-3">
              <input className="input" placeholder="Full name *"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="Phone number *" type="tel"
                value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Alt phone"
                value={form.altPhone} onChange={e => setForm({ ...form, altPhone: e.target.value })} />
              <input className="input" placeholder="Email" type="email"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
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
