"use client"
import { useState } from 'react'
import { api } from '@/lib/api'

export default function PaymentsSection({ residentId }: { residentId: string }) {
  const [loaded, setLoaded] = useState(false)
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.getResidentPayments(residentId)
      setPayments(Array.isArray(data) ? data : (data?.payments || []))
      setLoaded(true)
    } catch (e) { console.error(e) } finally { setLoading(false) }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Payment History</h3>
        {!loaded && <button onClick={load} className="btn-ghost w-full sm:w-auto">View Payment History</button>}
      </div>

      {loaded && (
        <div className="mt-3 space-y-2">
          {payments.length === 0 && <div className="text-sm text-slate-500">No payments found</div>}
          {payments.map(p => (
            <div key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between border rounded-md p-3">
              <div className="text-sm">
                <div className="font-medium">{p.billingMonth} • {p.status}</div>
                <div className="text-slate-500 text-sm">Amount: {p.totalAmount}</div>
              </div>
              <div className="text-sm text-slate-600 mt-2 sm:mt-0">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
