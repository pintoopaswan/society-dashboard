"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function VehiclesSection({ residentId, vehicles, currentFlatId }: { residentId: string; vehicles: any[]; currentFlatId?: string | null }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ type: '', plateNumber: '', make: '', model: '', color: '', parkingSlot: '' })
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<any[]>([])

  const saveOne = async (vehicle: any) => {
    const flatId = currentFlatId
    if (!flatId) throw new Error('Resident has no active flat')
    return api.addVehicle(residentId, { flatId, type: vehicle.type as any, plateNumber: vehicle.plateNumber, make: vehicle.make || undefined, model: vehicle.model || undefined, color: vehicle.color || undefined, parkingSlot: vehicle.parkingSlot || undefined })
  }

  const save = async () => {
    if (!form.type || !form.plateNumber) return alert('Registration number/type missing')
    setLoading(true)
    try {
      // Save current form + pending
      const toSave = [...pending, form]
      if (toSave.length === 0) return
      await Promise.all(toSave.map(v => saveOne(v)))
      setAdding(false)
      setPending([])
      setForm({ type: '', plateNumber: '', make: '', model: '', color: '', parkingSlot: '' })
      router.refresh()
    } catch (e: any) {
      console.error(e)
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      alert((e.message || 'API error') + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setLoading(false) }
  }

  const addAnother = () => {
    if (!form.type || !form.plateNumber) return alert('Registration number/type missing')
    setPending(p => [...p, form])
    setForm({ type: '', plateNumber: '', make: '', model: '', color: '', parkingSlot: '' })
  }

  const remove = async (vehicleId: string) => {
    if (!confirm('Delete vehicle?')) return
    setLoading(true)
    try {
      await api.deleteVehicle(residentId, vehicleId)
      router.refresh()
    } catch (e: any) {
      console.error(e)
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      alert((e.message || 'API error') + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setLoading(false) }
  }

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ type: '', plateNumber: '', make: '', model: '', color: '', parkingSlot: '' })

  const startEdit = (v: any) => {
    setEditingId(v.id)
    setEditForm({ type: v.type || '', plateNumber: v.plateNumber || '', make: v.make || '', model: v.model || '', color: v.color || '', parkingSlot: v.parkingSlot || '' })
  }

  const saveEdit = async (vehicleId: string) => {
    setLoading(true)
    try {
      const payload: any = { ...editForm }
      if (currentFlatId) payload.flatId = currentFlatId
      await api.updateVehicle(residentId, vehicleId, payload)
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
        <h3 className="font-semibold">Vehicles</h3>
        <button onClick={() => setAdding(v => !v)} className="btn-ghost">Add</button>
      </div>

      {adding && (
        <div className="mt-3 space-y-2">
          <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option value="">Vehicle type</option>
            <option value="CAR">CAR</option>
            <option value="BIKE">BIKE</option>
            <option value="SCOOTER">SCOOTER</option>
            <option value="CYCLE">CYCLE</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input className="input" placeholder="Registration Number" value={form.plateNumber} onChange={e => setForm({ ...form, plateNumber: e.target.value })} />
          <input className="input" placeholder="Make (optional)" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
          <input className="input" placeholder="Model (optional)" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
          <input className="input" placeholder="Color (optional)" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
          <input className="input" placeholder="Parking slot (optional)" value={form.parkingSlot} onChange={e => setForm({ ...form, parkingSlot: e.target.value })} />
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={() => setAdding(false)} className="btn-ghost w-full sm:flex-1">Cancel</button>
            <button onClick={addAnother} disabled={loading} className="btn-ghost w-full sm:flex-1">Add Another Vehicle</button>
            <button onClick={save} disabled={loading} className="btn-primary w-full sm:flex-1">Save Vehicles</button>
          </div>
          {pending.length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-slate-600 mb-2">Pending vehicles:</div>
              <div className="flex flex-wrap gap-2">
                {pending.map((p, i) => (
                  <div key={i} className="px-3 py-1 bg-surface-card border border-surface-border rounded-full text-sm">{p.type} • {p.plateNumber}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {vehicles.length === 0 && <div className="text-sm text-slate-500 col-span-full">No vehicles</div>}
        {vehicles.map(v => (
          <div key={v.id} className="border rounded-md p-3 bg-white shadow-sm">
              {editingId === v.id ? (
                <div className="space-y-2">
                  <select className="input" value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value })}>
                    <option value="">Vehicle type</option>
                    <option value="CAR">CAR</option>
                    <option value="BIKE">BIKE</option>
                    <option value="SCOOTER">SCOOTER</option>
                    <option value="CYCLE">CYCLE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                  <input className="input" value={editForm.plateNumber} placeholder="Registration Number" onChange={e => setEditForm({ ...editForm, plateNumber: e.target.value })} />
                  <input className="input" value={editForm.make} placeholder="Make" onChange={e => setEditForm({ ...editForm, make: e.target.value })} />
                  <input className="input" value={editForm.model} placeholder="Model" onChange={e => setEditForm({ ...editForm, model: e.target.value })} />
                  <input className="input" value={editForm.color} placeholder="Color" onChange={e => setEditForm({ ...editForm, color: e.target.value })} />
                  <input className="input" value={editForm.parkingSlot} placeholder="Parking slot" onChange={e => setEditForm({ ...editForm, parkingSlot: e.target.value })} />
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={() => setEditingId(null)} className="btn-ghost w-full sm:flex-1">Cancel</button>
                    <button onClick={() => saveEdit(v.id)} className="btn-primary w-full sm:flex-1">Save</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="font-medium">{v.type} • {v.plateNumber}</div>
                  {v.make && <div className="text-sm text-slate-600">{v.make} {v.model}</div>}
                  {v.color && <div className="text-sm text-slate-600">Color: {v.color}</div>}
                  {v.parkingSlot && <div className="text-sm text-slate-600">Slot: {v.parkingSlot}</div>}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => startEdit(v)} className="btn-ghost text-sm">Edit</button>
                    <button onClick={() => remove(v.id)} className="btn-ghost text-red-500 text-sm">Delete</button>
                  </div>
                </>
              )}
          </div>
        ))}
      </div>
    </div>
  )
}
