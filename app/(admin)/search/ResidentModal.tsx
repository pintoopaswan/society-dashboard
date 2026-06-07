"use client"
import React, { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { RefreshCw, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ResidentModal({ entry, onClose, onPaymentRecorded }: { entry: any; onClose: () => void; onPaymentRecorded: () => void }) {
  const [payments, setPayments] = useState<any[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const router = useRouter()

  const owner = entry.person ?? entry.ownerships?.[0]?.person
  const tenant = entry.flat?.tenancies?.[0]?.person ?? entry.tenancies?.[0]?.person ?? (entry.role === 'Tenant' ? entry.person : null)
  const flat = entry.flat ?? entry

  useEffect(() => {
    // ensure modal opens instantly with available data only
  }, [])

  const loadPayments = async () => {
    if (!flat?.id) return
    setPayLoading(true)
    try {
      const p = await api.getPayments(`?flatId=${flat.id}`)
      setPayments(p.sort((a: any, b: any) => b.billingMonth.localeCompare(a.billingMonth)))
      setShowPayments(true)
    } catch (e) {
      console.error(e)
    } finally { setPayLoading(false) }
  }

  const handleEditPayment = async (p: any) => {
    const mark = confirm('Mark this payment as PAID? (This will record payment)')
    if (!mark) return
    try {
      await api.recordPayment(p.id, { mode: 'CASH', lateFee: 0 })
      await loadPayments()
      onPaymentRecorded()
    } catch (e) { console.error(e) }
  }

  const totalCollection = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.totalAmount), 0)
  const pendingAmount = payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + Number(p.totalAmount), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Resident Profile</h2>
            <p className="text-sm text-slate-500">Complete profile for {flat?.block ?? ''} · Flat {flat?.flatNumber ?? flat?.flat}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-slate-500 hover:text-slate-900 p-2 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Flat</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{flat?.block ?? ''} · Flat {flat?.flatNumber ?? flat?.flat}</div>
                  <div className="text-xs text-slate-500 mt-1">{(flat?.status ?? '').replace('_',' ') || 'Unknown'}</div>
                </div>
                <div className="text-sm text-slate-400">{flat?.floor ?? ''}</div>
              </div>
            </div>

            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Owner</div>
              {owner ? (
                <div>
                  <div className="font-semibold text-slate-900">{owner.name}</div>
                  <div className="text-xs text-slate-500">{owner.phone}</div>
                  {owner.altPhone && <div className="text-xs text-slate-500">Alt: {owner.altPhone}</div>}
                  {owner.address && <div className="text-xs text-slate-500 mt-2">{owner.address}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`tel:${owner.phone}`} className="btn-ghost">Call Owner</a>
                    <button onClick={() => router.push(owner?.id ? `/residents/${owner.id}` : '/residents')} className="btn-ghost">Edit Owner</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">No owner information</div>
              )}
            </div>

            <div className="card p-4">
              <div className="text-xs text-slate-500 mb-1">Tenant</div>
              {tenant ? (
                <div>
                  <div className="font-semibold text-slate-900">{tenant.name}</div>
                  <div className="text-xs text-slate-500">{tenant.phone}</div>
                  {tenant.familyMembers && <div className="text-xs text-slate-500 mt-1">Family: {tenant.familyMembers.join(', ')}</div>}
                  {tenant.moveInDate && <div className="text-xs text-slate-500">Moved in: {tenant.moveInDate}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`tel:${tenant.phone}`} className="btn-ghost">Call Tenant</a>
                    <button onClick={() => router.push(tenant?.id ? `/residents/${tenant.id}` : '/residents')} className="btn-ghost">Edit Tenant</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-500">Vacant / No tenant information</div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-500">Vehicles</div>
              <div className="text-xs text-slate-400">{(entry.vehicles ?? []).length} vehicles</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(entry.vehicles ?? []).map((v: any, i: number) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-gray-50 border text-sm">
                  <div className="font-semibold">{v.plateNumber}</div>
                  <div className="text-xs text-slate-500">{v.type ?? 'Vehicle'}</div>
                  <div className="mt-2"><button onClick={() => router.push(`/vehicles`)} className="text-xs text-emerald-600">Edit Vehicle</button></div>
                </div>
              ))}
              {(entry.vehicles ?? []).length === 0 && <div className="text-sm text-slate-500">No vehicles listed</div>}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Payment History</div>
                <div className="text-sm text-slate-900">{showPayments ? 'Loaded' : 'Hidden'}</div>
              </div>
              <div className="flex items-center gap-2">
                {!showPayments && <button onClick={loadPayments} className="btn-primary">View Payment History</button>}
                {showPayments && <button onClick={() => { setShowPayments(false); setPayments([]) }} className="btn-ghost">Hide</button>}
              </div>
            </div>

            {showPayments && (
              <div className="mt-3">
                {payLoading ? (
                  <div className="flex items-center gap-2 text-slate-500"><RefreshCw className="animate-spin" /> Loading…</div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <div className="text-sm font-semibold">₹{totalCollection.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">Total Collected</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <div className="text-sm font-semibold">₹{pendingAmount.toLocaleString()}</div>
                        <div className="text-xs text-slate-500">Pending</div>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <div className="text-sm font-semibold">{payments.length}</div>
                        <div className="text-xs text-slate-500">Recent</div>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                          <div>
                            <div className="font-semibold">{p.billingMonth}</div>
                            <div className="text-xs text-slate-500">{p.paidAt ? `Paid ${new Date(p.paidAt).toLocaleDateString()}` : 'Not paid'}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">₹{Number(p.totalAmount).toLocaleString()}</div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => handleEditPayment(p)} className="btn-ghost">Edit</button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {payments.length === 0 && <div className="text-sm text-slate-500">No payment records found</div>}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
