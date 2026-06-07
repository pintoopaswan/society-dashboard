"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { searchAll, api, Payment } from '@/lib/api'

const ROLE_BADGE: Record<string, { bg: string; color: string; dot: string }> = {
  Owner:  { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75' },
  Tenant: { bg: '#E6F1FB', color: '#185FA5', dot: '#378ADD' },
}
const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  OWNER_OCCUPIED: { bg: '#E1F5EE', color: '#0F6E56' },
  RENTED:         { bg: '#E6F1FB', color: '#185FA5' },
  VACANT:         { bg: '#F1EFE8', color: '#5F5E5A' },
  LOCKED:         { bg: '#FCEBEB', color: '#E24B4A' },
}
const PAY_BADGE: Record<string, { bg: string; color: string }> = {
  PAID:    { bg: '#E1F5EE', color: '#0F6E56' },
  PENDING: { bg: '#FAEEDA', color: '#BA7517' },
  OVERDUE: { bg: '#FCEBEB', color: '#E24B4A' },
}

function Badge({ label, bg, color, dot }: { label: string; bg: string; color: string; dot?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color }}>
      {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot, display: 'inline-block' }} />}
      {label}
    </span>
  )
}

function Avatar({ name, size = 36, bg = '#E1F5EE', color = '#0F6E56', border = '#5DCAA5' }: any) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `1.5px solid ${border}`, color, fontWeight: 700, fontSize: size * 0.38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  )
}

function DetailPanel({ entry, onClose, onPaymentRecorded }: { entry: any; onClose: () => void; onPaymentRecorded: () => void }) {
  const [payments, setPayments]     = useState<Payment[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [recording, setRecording]   = useState<Payment | null>(null)
  const [mode, setMode]             = useState('CASH')
  const [lateFee, setLateFee]       = useState(0)
  const [saving, setSaving]         = useState(false)

  const { person, flat, role, vehicles, vehicle } = entry
  // Cross reference: resolve owner and tenant from entry
  const owner = role === 'Owner' ? person : (entry.ownerships?.[0]?.person ?? flat?.ownerships?.[0]?.person)
  const tenant = role === 'Tenant' ? person : (entry.tenancies?.[0]?.person ?? flat?.tenancies?.[0]?.person)
  const allVehicles = entry.vehicles ?? (vehicles ?? (vehicle ? [vehicle] : []))

  const loadPayments = async () => {
    if (!flat?.id) return
    setPayLoading(true)
    try {
      const p = await api.getPayments(`?flatId=${flat.id}`)
      setPayments(p.sort((a: Payment, b: Payment) => b.billingMonth.localeCompare(a.billingMonth)))
      setShowPayments(true)
    } catch (e) {
      console.error(e)
    } finally { setPayLoading(false) }
  }

  const paid    = payments.filter(p => p.status === 'PAID').length
  const unpaid  = payments.filter(p => p.status !== 'PAID').length
  const totalDue = payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + Number(p.totalAmount), 0)

  const handleRecord = async () => {
    if (!recording) return
    setSaving(true)
    try {
      await api.recordPayment(recording.id, { mode, lateFee })
      setRecording(null); setLateFee(0)
      await loadPayments()
      onPaymentRecorded()
    } finally { setSaving(false) }
  }

  const roleStyle = role ? (ROLE_BADGE[role] ?? ROLE_BADGE.Owner) : null

  const sectionTitle = (icon: string, label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: 'var(--text-muted)', marginBottom: 10 }}>
      <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 14, color: 'var(--text-hint)' }} /> {label}
    </div>
  )

  const detailRow = (icon: string, label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
        <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 14, width: 16, color: 'var(--text-hint)' }} /> {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{value}</div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--surface)', borderLeft: '1px solid var(--border)', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>

        {/* Header */}
        <div style={{ background: 'var(--green-light)', borderBottom: '1px solid #9FE1CB', padding: '18px 20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase' as const, color: 'var(--green-dark)' }}>Resident Detail</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green-dark)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}>
              <i className="ti ti-x" style={{ fontSize: 18 }} />
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Avatar name={person?.name ?? owner?.name ?? tenant?.name} size={48} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--green-dark)', marginBottom: 6 }}>{person?.name ?? owner?.name ?? tenant?.name ?? 'Unknown'}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
                {roleStyle && <Badge label={role} bg={roleStyle.bg} color={roleStyle.color} dot={roleStyle.dot} />}
                {flat && <Badge label={`${flat.block} · ${flat.flatNumber}`} bg="rgba(29,158,117,.15)" color="var(--green-dark)" />}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>

          {/* Owner */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {sectionTitle('ti-user-circle', 'Owner')}
            {owner ? (
              <>
                {detailRow('ti-user', 'Name', owner.name)}
                {owner.phone && detailRow('ti-phone', 'Phone', owner.phone)}
                {owner.altPhone && detailRow('ti-phone', 'Alternate', <span style={{ color: 'var(--text-muted)' }}>{owner.altPhone}</span>)}
                {owner.address && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>{owner.address}</div>}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <a href={`tel:${owner.phone}`} className="btn-ghost">Call Owner</a>
                  <button onClick={() => window.location.href = (owner?.id ? `/residents/${owner.id}` : '/residents')} className="btn-ghost">Edit Owner</button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">No owner information</div>
            )}
          </div>

          {/* Tenant */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {sectionTitle('ti-user', 'Tenant')}
            {tenant ? (
              <>
                {detailRow('ti-user', 'Name', tenant.name)}
                {tenant.phone && detailRow('ti-phone', 'Phone', tenant.phone)}
                {tenant.familyMembers && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>Family: {tenant.familyMembers.join(', ')}</div>}
                {tenant.moveInDate && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)'}}>Moved in: {tenant.moveInDate}</div>}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <a href={`tel:${tenant.phone}`} className="btn-ghost">Call Tenant</a>
                  <button onClick={() => window.location.href = (tenant?.id ? `/residents/${tenant.id}` : '/residents')} className="btn-ghost">Edit Tenant</button>
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500">Vacant / No tenant information</div>
            )}
          </div>

          {/* Vehicles */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            {sectionTitle('ti-car', 'Vehicles')}
            <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
              {allVehicles.map((v: any, i: number) => (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 12, background: 'var(--gray-50)', border: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--gray-800)' }}>
                  <i className="ti ti-car" aria-hidden style={{ fontSize: 13, color: 'var(--text-muted)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{v.plateNumber}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.type ?? ''}</span>
                  </div>
                </span>
              ))}
              {allVehicles.length === 0 && <div className="text-sm text-slate-500">No vehicles listed</div>}
            </div>
          </div>

          {/* Payment history (lazy) */}
          {flat && (
            <div style={{ padding: '16px 20px' }}>
              {sectionTitle('ti-receipt', 'Payment History')}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div className="text-sm text-slate-500">{showPayments ? `${payments.length} records` : 'Hidden'}</div>
                <div className="flex gap-2">
                  {!showPayments && <button onClick={loadPayments} className="btn-primary">View Payment History</button>}
                  {showPayments && <button onClick={() => { setShowPayments(false); setPayments([]) }} className="btn-ghost">Hide</button>}
                </div>
              </div>

              {showPayments && (
                <div style={{ marginTop: 12 }}>
                  {payLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)' }}>
                      <i className="ti ti-loader-2" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }} /> Loading…
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>₹{payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.totalAmount), 0)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Collected</div>
                        </div>
                        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>₹{payments.filter(p => p.status !== 'PAID').reduce((s, p) => s + Number(p.totalAmount), 0)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</div>
                        </div>
                        <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', textAlign: 'center' }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{payments.length}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Recent</div>
                        </div>
                      </div>

                      <div style={{ maxHeight: 220, overflowY: 'auto', display: 'grid', gap: 8 }}>
                        {payments.map(p => (
                          <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', border: '1px solid var(--border)', borderRadius: 8, background: 'white' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.billingMonth}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.paidAt ? `Paid ${new Date(p.paidAt).toLocaleDateString()}` : 'Not paid'}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>₹{Number(p.totalAmount).toLocaleString()}</div>
                              <div style={{ marginTop: 6, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button onClick={() => { setRecording(p) }} className="btn-ghost">Edit</button>
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
          )}
        </div>
      </div>

      {/* Record payment modal */}
      {recording && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.06)' }} onClick={() => setRecording(null)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, boxShadow: 'var(--shadow-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Record Payment</div>
              <button onClick={() => setRecording(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <i className="ti ti-x" style={{ fontSize: 18 }} />
              </button>
            </div>

            <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{flat?.block} · Flat {flat?.flatNumber}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{recording.billingMonth}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)', marginTop: 4 }}>₹{Number(recording.totalAmount).toLocaleString()}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Payment Mode</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {['CASH','UPI','ONLINE'].map(m => (
                  <button key={m} onClick={() => setMode(m)} style={{
                    padding: '8px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                    background: mode === m ? 'var(--green)' : 'var(--gray-50)',
                    color: mode === m ? '#fff' : 'var(--text-muted)',
                    border: `1px solid ${mode === m ? 'var(--green)' : 'var(--border)'}`,
                  }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div className="section-label" style={{ marginBottom: 8 }}>Late Fee (₹)</div>
              <input type="number" style={{ width: '100%', padding: '9px 14px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text)', background: 'var(--gray-50)', outline: 'none', fontFamily: 'inherit' }}
                placeholder="0" value={lateFee} onChange={e => setLateFee(Number(e.target.value))} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setRecording(null)} style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'var(--gray-100)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleRecord} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'var(--green)', color: '#fff', border: '1px solid var(--green)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving…' : `Confirm ₹${(Number(recording.totalAmount) + lateFee).toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────

export default function SearchPage() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<any[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError]       = useState('')
  const [selected, setSelected] = useState<any | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController | null>(null)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const LIMIT = 40

  useEffect(() => { inputRef.current?.focus() }, [])

  // Open detail when navigated from global search
  useEffect(() => {
    try {
      const raw = localStorage.getItem('globalSearchSelected')
      if (!raw) return
      const payload = JSON.parse(raw)
      localStorage.removeItem('globalSearchSelected')
      // Use payload as selected entry and show its panel
      setSelected(payload)
      setSearched(true)
      setResults(payload ? [payload] : [])
    } catch (e) { /* ignore */ }
  }, [])

  const doSearch = useCallback(async (q: string, append = false) => {
    if (!q || q.length < 3) {
      setResults([]); setSearched(false); setHasMore(false); setOffset(0)
      return
    }

    // cancel previous request
    controllerRef.current?.abort()
    const ctl = new AbortController()
    controllerRef.current = ctl

    if (!append) {
      setLoading(true); setError('')
    }

    try {
      const res = await searchAll(q, { limit: LIMIT, offset: append ? offset : 0 }, { signal: ctl.signal })
      if (append) setResults(prev => [...prev, ...res])
      else setResults(res)
      setSearched(true)
      setHasMore(res.length === LIMIT)
      setOffset(prev => append ? prev + res.length : res.length)
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [offset])

  const handleChange = (v: string) => {
    setQuery(v)
  }

  // Auto-search when query length >= 3 (debounced)
  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]); setSearched(false); setHasMore(false); setOffset(0)
      return
    }
    const t = window.setTimeout(() => {
      setOffset(0)
      doSearch(query, false)
    }, 250)
    return () => window.clearTimeout(t)
  }, [query, doSearch])

  const loadMore = () => {
    if (!hasMore || loading) return
    doSearch(query, true)
  }

  // Deduplicate / group by person+flat
  const grouped: any[] = Object.values(
    results.reduce((acc: any, r: any) => {
      const key = `${r.person?.id ?? 'np'}-${r.flat?.id ?? 'nf'}`
      if (!acc[key]) acc[key] = { ...r }
      if (r.vehicles?.length) acc[key].vehicles = [...(acc[key].vehicles ?? []), ...r.vehicles]
      return acc
    }, {})
  )

  const hints = [
    { icon: 'ti-user',     label: 'By Name',    ex: 'Rahul Sharma' },
    { icon: 'ti-phone',    label: 'By Phone',   ex: '9876543210' },
    { icon: 'ti-hash',     label: 'By Flat',    ex: '101, 302' },
    { icon: 'ti-car',      label: 'By Vehicle', ex: 'CG04AB1234' },
  ]

  return (
    <>
      {/* Page header */}
      <div style={{ marginBottom: 20 }} className="fade-up">
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Resident Search</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Find owners, tenants, flats &amp; vehicles instantly</div>
      </div>

      {/* Search card */}
      <div className="card fade-up fade-up-1" style={{ padding: 20, marginBottom: 20 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>Search residents, flats &amp; vehicles</div>
        <div style={{ position: 'relative' }}>
            <form style={{ position: 'relative' }} onSubmit={e => e.preventDefault()}>
            <i className="ti ti-search" aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-hint)', fontSize: 17, pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              style={{ width: '100%', padding: '10px 120px 10px 38px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 14, color: 'var(--text)', background: 'var(--gray-50)', outline: 'none', fontFamily: 'inherit', transition: 'all .15s' }}
              placeholder="Name, phone, flat no. (e.g. 101), vehicle plate (e.g. CG04AB1234)…"
              value={query}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setQuery(''); setResults([]); setSearched(false) } }}
              onFocus={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--green)'; (e.target as HTMLInputElement).style.background = 'var(--surface)'; (e.target as HTMLInputElement).style.boxShadow = '0 0 0 3px rgba(29,158,117,0.08)' }}
              onBlur={e => { (e.target as HTMLInputElement).style.borderColor = 'var(--border)'; (e.target as HTMLInputElement).style.background = 'var(--gray-50)'; (e.target as HTMLInputElement).style.boxShadow = 'none' }}
            />
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => { setQuery(''); setResults([]); setSearched(false); inputRef.current?.focus() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-hint)', fontSize: 14 }} title="Clear">✕</button>
            </div>
            {loading && <i className="ti ti-loader-2" aria-hidden style={{ position: 'absolute', right: 120, top: '50%', transform: 'translateY(-50%)', color: 'var(--green)', fontSize: 17, animation: 'spin 1s linear infinite' }} />}
          </form>
        </div>

        {/* Hint tags */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' as const }}>
          {hints.map(h => (
            <span key={h.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, border: '1px solid var(--border)', color: 'var(--text-muted)', background: 'var(--surface)', cursor: 'default' }}>
              <i className={`ti ${h.icon}`} aria-hidden style={{ fontSize: 12 }} /> {h.label} <span style={{ color: 'var(--text-hint)', fontWeight: 400 }}>· {h.ex}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FCEBEB', border: '1px solid #F7C1C1', borderRadius: 10, padding: '10px 14px', marginBottom: 16, color: '#E24B4A', fontSize: 13 }}>
          <i className="ti ti-alert-circle" aria-hidden style={{ fontSize: 16 }} /> {error}
        </div>
      )}

      {/* Hint cards — shown before search */}
      {!searched && !loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 20 }} className="fade-up fade-up-2">
          {hints.map(h => (
            <div key={h.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
              <i className={`ti ${h.icon}`} aria-hidden style={{ fontSize: 22, color: 'var(--green)', marginBottom: 8, display: 'block' }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>{h.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-hint)' }}>{h.ex}</div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {searched && grouped.length === 0 && !loading && (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <i className="ti ti-search-off" aria-hidden style={{ fontSize: 36, color: 'var(--gray-200)', marginBottom: 12, display: 'block' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No results for "{query}"</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Try a different name, phone number, flat or vehicle number</div>
        </div>
      )}

      {/* Results */}
      {grouped.length > 0 && (
        <div className="fade-up">
          <div className="section-label" style={{ marginBottom: 10 }}>{grouped.length} result{grouped.length !== 1 ? 's' : ''} for "{query}"</div>
          <div className="card" style={{ overflow: 'hidden' }}>
            {grouped.map((r: any, i: number) => {
              const roleStyle = r.role ? (ROLE_BADGE[r.role] ?? ROLE_BADGE.Owner) : null
              const avatarColors = [
                { bg: '#E1F5EE', color: '#0F6E56', border: '#5DCAA5' },
                { bg: '#E6F1FB', color: '#185FA5', border: '#85B7EB' },
                { bg: '#FAEEDA', color: '#BA7517', border: '#FAC775' },
              ]
              const ac = avatarColors[i % avatarColors.length]

              return (
                <div
                  key={i}
                  onClick={() => setSelected(r)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background .12s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--green-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar name={r.person?.name} size={36} bg={ac.bg} color={ac.color} border={ac.border} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.person?.name ?? 'Unknown'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' as const }}>
                      {r.person?.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <i className="ti ti-phone" aria-hidden style={{ fontSize: 12 }} /> {r.person.phone}
                        </span>
                      )}
                      {r.flat && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <i className="ti ti-building" aria-hidden style={{ fontSize: 12 }} /> {r.flat.block} · {r.flat.flatNumber}
                        </span>
                      )}
                      {(r.vehicle ?? r.vehicles?.[0]) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                          <i className="ti ti-car" aria-hidden style={{ fontSize: 12 }} /> {(r.vehicle ?? r.vehicles[0]).plateNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {roleStyle && <Badge label={r.role} bg={roleStyle.bg} color={roleStyle.color} dot={roleStyle.dot} />}
                    <i className="ti ti-chevron-right" aria-hidden style={{ fontSize: 16, color: 'var(--text-hint)' }} />
                  </div>
                </div>
              )
            })}
            {hasMore && (
              <div style={{ padding: 12, textAlign: 'center' }}>
                <button onClick={loadMore} className="btn-ghost">Load more</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail panel (drawer) */}
      {selected && (
        <DetailPanel
          entry={selected}
          onClose={() => setSelected(null)}
          onPaymentRecorded={() => {}}
        />
      )}

      <style>{`@keyframes spin{from{transform:translateY(-50%) rotate(0)}to{transform:translateY(-50%) rotate(360deg)}}`}</style>
    </>
  )
}