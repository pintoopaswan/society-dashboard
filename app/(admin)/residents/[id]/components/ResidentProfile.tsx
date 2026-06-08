"use client"
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api, Person } from '@/lib/api'
import { Edit3, Trash2, ArrowLeft } from 'lucide-react'

export default function ResidentProfile({ resident }: { resident: Person }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: resident.name || '', phone: resident.phone || '', email: resident.email || '',
    aadhaarLast4: (resident as any).aadhaarLast4 || '', panNumber: (resident as any).panNumber || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setLoading(true)
    try {
      await api.updateResident(resident.id, form as any)
      setEditing(false)
      router.refresh()
    } catch (e: any) {
      console.error(e)
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      setError((e.message || 'API error') + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setLoading(false) }
  }

  const remove = async () => {
    if (!confirm('Delete resident? This cannot be undone.')) return
    setLoading(true)
    try {
      await api.deleteResident(resident.id)
      router.push('/residents')
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Link href="/residents" className="text-slate-500 hover:text-slate-900 flex items-center gap-2">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(v => !v)} className="btn-ghost"><Edit3 size={14} /></button>
          <button onClick={remove} className="btn-ghost text-red-500"><Trash2 size={14} /></button>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:gap-6">
        <div className="w-16 h-16 rounded-full bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 font-display font-bold text-xl">
          {resident.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{resident.name}</h2>
          <p className="text-sm text-slate-500">{resident.phone}</p>

          {!editing ? (
            <div className="mt-3 text-sm text-slate-600 space-y-1">
              {error && <div className="text-red-400 text-sm bg-red-500/10 rounded-xl px-3 py-2">{error}</div>}
              {resident.email && <div>Email: {resident.email}</div>}
              {(resident as any).aadhaarLast4 && <div>Aadhaar: **** {(resident as any).aadhaarLast4}</div>}
              {(resident as any).panNumber && <div>PAN: {(resident as any).panNumber}</div>}
              {(resident as any).createdAt && <div>Created: {new Date((resident as any).createdAt).toLocaleString()}</div>}
              {(resident as any).updatedAt && <div>Updated: {new Date((resident as any).updatedAt).toLocaleString()}</div>}
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              <input className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="Aadhaar last 4" value={(form as any).aadhaarLast4} onChange={e => setForm({ ...(form as any), aadhaarLast4: e.target.value })} />
              <input className="input" placeholder="PAN" value={(form as any).panNumber} onChange={e => setForm({ ...(form as any), panNumber: e.target.value })} />
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button onClick={() => setEditing(false)} className="btn-ghost w-full sm:flex-1">Cancel</button>
                <button onClick={save} disabled={loading} className="btn-primary w-full sm:flex-1">{loading ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
