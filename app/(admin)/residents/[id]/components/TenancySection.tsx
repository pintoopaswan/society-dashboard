"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Plus, Calendar, X } from 'lucide-react'

export default function TenancySection({ residentId, tenancies }: { residentId: string; tenancies: any[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [flats, setFlats] = useState<any[]>([])
  const [form, setForm] = useState({ flatId: '', startDate: '', rentAmount: '', deposit: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    api.getFlats().then(f => { if (mounted) setFlats(f) }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const save = async () => {
    if (!form.flatId || !form.startDate) return alert('Flat and start date required')
    setLoading(true)
    try {
      await api.addTenancy(residentId, { flatId: form.flatId, startDate: form.startDate, rentAmount: Number(form.rentAmount) || undefined, deposit: Number(form.deposit) || undefined })
      setAdding(false)
      setForm({ flatId: '', startDate: '', rentAmount: '', deposit: '' })
      router.refresh()
    } catch (e: any) {
      console.error(e)
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      alert((e.message || 'API error') + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setLoading(false) }
  }

  const endTenancy = async (tenancyId: string) => {
    if (!confirm('End tenancy?')) return
    setLoading(true)
    try {
      await api.endTenancy(residentId, tenancyId, { endDate: new Date().toISOString().slice(0,10) })
      router.refresh()
    } catch (e: any) {
      console.error(e)
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      alert((e.message || 'API error') + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setLoading(false) }
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ rentAmount: '', deposit: '' })

  const startEdit = (t: any) => {
    setEditingId(t.id)
    setEditForm({ rentAmount: t.rentAmount?.toString() || '', deposit: t.deposit?.toString() || '' })
  }

  const saveEdit = async (tenancyId: string) => {
    setLoading(true)
    try {
      await api.updateTenancy(residentId, tenancyId, { rentAmount: Number(editForm.rentAmount) || undefined, deposit: Number(editForm.deposit) || undefined })
      setEditingId(null)
      router.refresh()
    } catch (e: any) {
      console.error(e)
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      alert((e.message || 'API error') + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Tenancy</h3>
        <button onClick={() => setAdding(v => !v)} className="btn-ghost flex items-center gap-2"><Plus size={14} /> Add Tenancy</button>
      </div>

      {adding && (
        <div className="mt-3 space-y-2">
          <select className="input" value={form.flatId} onChange={e => setForm({ ...form, flatId: e.target.value })}>
            <option value="">Select flat</option>
            {flats.map(f => <option key={f.id} value={f.id}>{f.block?.name}-{f.flatNumber}</option>)}
          </select>
          <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          <input className="input" placeholder="Rent amount" value={form.rentAmount} onChange={e => setForm({ ...form, rentAmount: e.target.value })} />
          <input className="input" placeholder="Deposit" value={form.deposit} onChange={e => setForm({ ...form, deposit: e.target.value })} />
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setAdding(false)} className="btn-ghost w-full sm:flex-1">Cancel</button>
            <button onClick={save} disabled={loading} className="btn-primary w-full sm:flex-1">Save</button>
          </div>
        </div>
      )}

      <div className="mt-3 space-y-2">
        {tenancies.length === 0 && <div className="text-sm text-slate-500">No tenancy history</div>}
        {tenancies.map(t => (
          <div key={t.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border rounded-md p-3">
            <div className="text-sm w-full sm:w-3/4">
              <div className="font-medium">{t.flat?.block?.name}-{t.flat?.flatNumber}</div>
              <div className="text-slate-500">Start: {t.startDate} {t.endDate ? `• Ended: ${t.endDate}` : ''}</div>
              {!t.endDate && editingId === t.id && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input className="input" placeholder="Rent" value={editForm.rentAmount} onChange={e => setEditForm({ ...editForm, rentAmount: e.target.value })} />
                  <input className="input" placeholder="Deposit" value={editForm.deposit} onChange={e => setEditForm({ ...editForm, deposit: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 mt-3 sm:mt-0">
              <div className="text-sm text-slate-600">Rent: {t.rentAmount || '-'}</div>
              {!t.endDate && (
                editingId === t.id ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="btn-ghost text-sm">Cancel</button>
                    <button onClick={() => saveEdit(t.id)} className="btn-primary text-sm">Save</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(t)} className="btn-ghost text-sm">Edit</button>
                    <button onClick={() => endTenancy(t.id)} className="btn-ghost text-sm">End</button>
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
