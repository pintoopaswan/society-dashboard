"use client"
import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  brand:      '#0F766E',
  brandLight: '#F0FDFA',
  brandMid:   '#99F6E4',
  purple:     '#7C3AED',
  purpleLight:'#EDE9FE',
  tealBg:     '#CCFBF1', tealText:   '#0F766E',
  blueBg:     '#DBEAFE', blueText:   '#1D4ED8',
  amberBg:    '#FEF3C7', amberText:  '#92400E',
  redBg:      '#FEE2E2', redText:    '#B91C1C',
  grayBg:     '#F3F4F6', grayText:   '#6B7280',
  greenBg:    '#DCFCE7', greenText:  '#166534',
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  OWNER_OCCUPIED: { bg: '#CCFBF1', color: '#0F766E', label: 'Owner Occupied'  },
  RENTED:         { bg: '#DBEAFE', color: '#1D4ED8', label: 'Tenant Occupied' },
  TENANT:         { bg: '#DBEAFE', color: '#1D4ED8', label: 'Tenant'          },
  VACANT:         { bg: '#F3F4F6', color: '#6B7280', label: 'Vacant'          },
  LOCKED:         { bg: '#FEE2E2', color: '#B91C1C', label: 'Locked'          },
}

const PAY_BADGE: Record<string, { bg: string; color: string }> = {
  PAID:    { bg: '#DCFCE7', color: '#166534' },
  PENDING: { bg: '#FEF3C7', color: '#92400E' },
  OVERDUE: { bg: '#FEE2E2', color: '#B91C1C' },
  PARTIAL: { bg: '#DBEAFE', color: '#1D4ED8' },
}

function DetailRow({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 0', borderBottom:'1px solid var(--border)' }}>
      <div style={{ fontSize:12, color:'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)', textAlign:'right' as const, maxWidth:'60%' }}>
        {href
          ? <a href={href} style={{ color:'#0F766E', textDecoration:'none', fontWeight:600 }}>{value}</a>
          : value ?? '—'}
      </div>
    </div>
  )
}

function SectionCard({
  accentColor, iconBg, icon, title, subtitle, editLabel, onEdit, children
}: {
  accentColor: string; iconBg: string; icon: string; title: string; subtitle?: string;
  editLabel?: string; onEdit?: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
      <div style={{ borderTop:`3px solid ${accentColor}`, padding:'13px 18px 11px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:9, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className={`ti ${icon}`} aria-hidden style={{ fontSize:15, color:accentColor }} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{subtitle}</div>}
          </div>
        </div>
        {editLabel && onEdit && (
          <button onClick={onEdit} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8, fontSize:12, fontWeight:600, background:'var(--gray-50)', border:'1px solid var(--border)', color:'var(--text-muted)', cursor:'pointer' }}>
            <i className="ti ti-edit" aria-hidden style={{ fontSize:12 }} />{editLabel}
          </button>
        )}
      </div>
      <div style={{ padding:'14px 18px' }}>{children}</div>
    </div>
  )
}

function StatBadge({ value, label, color, bg }: { value: string|number; label: string; color: string; bg: string }) {
  return (
    <div style={{ flex:1, background:bg, borderRadius:12, padding:'14px 16px', border:`1px solid ${color}30` }}>
      <div style={{ fontSize:30, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, fontWeight:500 }}>{label}</div>
    </div>
  )
}

export default function ResidentModal({
  entry, onClose, onPaymentRecorded
}: {
  entry: any; onClose: () => void; onPaymentRecorded: () => void
}) {
  const [payments,    setPayments]    = useState<any[]>([])
  const [payLoading,  setPayLoading]  = useState(true)
  const [recording,   setRecording]   = useState<any|null>(null)
  const [mode,        setMode]        = useState('CASH')
  const [lateFee,     setLateFee]     = useState(0)
  const [saving,      setSaving]      = useState(false)
  const [payYear,     setPayYear]     = useState('All Years')
  const [payStatus,   setPayStatus]   = useState('All Statuses')
  const router = useRouter()

  const owner  = entry.person ?? entry.ownerships?.[0]?.person
  const tenant = entry.flat?.tenancies?.[0]?.person
              ?? entry.tenancies?.[0]?.person
              ?? (entry.role === 'Tenant' ? entry.person : null)
  const flat   = entry.flat ?? entry

  const flatBlock   = flat?.block?.name ?? flat?.block ?? ''
  const flatNum     = flat?.flatNumber ?? flat?.flat ?? ''
  const flatCode    = flatBlock && flatNum ? `${flatBlock.replace('Block-', 'B')}-${flatNum}` : ''
  const flatLabel   = flatBlock && flatNum ? `${flatBlock} / Flat ${flatNum}` : ''

  const occKey  = flat?.status ?? (tenant ? 'RENTED' : 'VACANT')
  const occMeta = STATUS_BADGE[occKey] ?? STATUS_BADGE.VACANT

  const loadPayments = useCallback(async () => {
    if (!flat?.id) { setPayLoading(false); return }
    setPayLoading(true)
    try {
      const p = await api.getPayments(`?flatId=${flat.id}`)
      setPayments(p.sort((a: any, b: any) => b.billingMonth.localeCompare(a.billingMonth)))
    } catch (e) { console.error(e) }
    finally { setPayLoading(false) }
  }, [flat?.id])

  useEffect(() => { loadPayments() }, [loadPayments])

  // Keyboard close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleRecord = async () => {
    if (!recording) return
    setSaving(true)
    try {
      await api.recordPayment(recording.id, { mode, lateFee })
      setRecording(null); setLateFee(0)
      await loadPayments()
      onPaymentRecorded()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  const paidCount    = payments.filter(p => p.status === 'PAID').length
  const pendingCount = payments.filter(p => p.status === 'PENDING' || p.status === 'OVERDUE').length
  const partialCount = payments.filter(p => p.status === 'PARTIAL').length
  const totalCount   = payments.length

  const availableYears = [...new Set(payments.map(p => p.billingMonth?.split(' ')[1]).filter(Boolean))].sort().reverse() as string[]

  const filteredPayments = payments.filter(p => {
    const yearOk   = payYear === 'All Years'     || p.billingMonth?.includes(payYear)
    const statusOk = payStatus === 'All Statuses' || p.status === payStatus
    return yearOk && statusOk
  })

  const totalCollected = payments.filter(p => p.status === 'PAID').reduce((s, p) => s + Number(p.totalAmount), 0)

  const inputStyle: React.CSSProperties = {
    padding:'10px 12px', borderRadius:10, border:'1.5px solid var(--border)',
    fontSize:13, color:'var(--text)', background:'var(--gray-50)',
    fontFamily:'inherit', outline:'none', width:'100%'
  }

  if (typeof document === 'undefined') return null

  const SIDEBAR = 240 // px — matches the app sidebar width

  return createPortal(
    <>
      {/* Dim overlay — content area only, sidebar stays visible */}
      <div style={{ position:'fixed', top:0, left:SIDEBAR, right:0, bottom:0, zIndex:9998, background:'rgba(0,0,0,0.35)' }} onClick={onClose} />

      <div
        style={{ position:'fixed', top:0, left:SIDEBAR, right:0, bottom:0, zIndex:9999, display:'flex', flexDirection:'column', overflowY:'auto', background:'var(--gray-50,#F9FAFB)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky top bar */}
        <div style={{ background:'white', borderBottom:'1px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, flexShrink:0 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>Flat Search</div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>MIG Society, Sector-29 · Resident profile &amp; payment history</div>
          </div>
          <button onClick={onClose} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, fontSize:13, fontWeight:600, background:'var(--gray-100)', border:'1px solid var(--border)', color:'var(--text)', cursor:'pointer' }}>
            <i className="ti ti-x" aria-hidden style={{ fontSize:14 }} />Close
          </button>
        </div>

        {/* Flat identity row */}
        <div style={{ padding:'20px 24px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' as const }}>
            <div style={{ background:T.purple, color:'white', fontWeight:800, fontSize:15, borderRadius:12, padding:'10px 18px', letterSpacing:'.02em', display:'flex', alignItems:'center', gap:7 }}>
              <i className="ti ti-home-2" aria-hidden style={{ fontSize:14 }} />{flatCode || 'Flat'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:20, fontWeight:800, color:'var(--text)', letterSpacing:'-.01em' }}>{flatLabel}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:3, display:'flex', gap:10, flexWrap:'wrap' as const }}>
                {!payLoading && <span>{totalCount} payment records</span>}
                {owner  && <span>· {owner.name}</span>}
                {tenant && <span>· Tenant: {tenant.name}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600, background:'white', border:'1px solid var(--border)', color:'var(--text-muted)', cursor:'pointer' }}>
              <i className="ti ti-x" aria-hidden style={{ fontSize:14 }} />Close
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding:'20px 24px 32px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Flat Info */}
          <SectionCard accentColor="#0F766E" iconBg="#CCFBF1" icon="ti-home-2" title="Flat Information" subtitle={`${flatNum} · ${flatBlock}`}>
            <DetailRow label="Block"   value={flatBlock || '—'} />
            <DetailRow label="Flat No." value={flatNum || '—'} />
            <DetailRow label="Floor"   value={flat?.floor ?? '—'} />
            <DetailRow label="Status"  value={
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:700, background:occMeta.bg, color:occMeta.color }}>
                {occMeta.label}
              </span>
            } />
          </SectionCard>

          {/* Owner */}
          <SectionCard accentColor="#0F766E" iconBg="#CCFBF1" icon="ti-user-circle" title="Owner Details" subtitle={owner?.name ?? 'No owner'} editLabel={owner ? 'Edit' : undefined} onEdit={()=>router.push(owner?.id ? `/residents/${owner.id}` : '/residents')}>
            {owner ? (
              <>
                <DetailRow label="Name"          value={owner.name} />
                <DetailRow label="Mobile"        value={owner.phone}    href={owner.phone ? `tel:${owner.phone}` : undefined} />
                <DetailRow label="Alternate"     value={owner.altPhone ?? '—'} />
                <DetailRow label="Email"         value={owner.email ?? '—'} />
                <DetailRow label="City/Location" value={owner.address ?? '—'} />
              </>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-hint)', padding:'8px 0' }}>No owner information available</div>
            )}
          </SectionCard>

          {/* Tenant */}
          <SectionCard accentColor="#2563EB" iconBg="#DBEAFE" icon="ti-users" title="Tenant Details" subtitle={tenant ? `Occupied by ${tenant.name}` : 'Vacant'} editLabel={tenant ? 'Edit' : undefined} onEdit={()=>router.push(tenant?.id ? `/residents/${tenant.id}` : '/residents')}>
            {tenant ? (
              <>
                <DetailRow label="Name"         value={tenant.name} />
                <DetailRow label="Mobile"       value={tenant.phone}   href={tenant.phone ? `tel:${tenant.phone}` : undefined} />
                <DetailRow label="Email"        value={tenant.email ?? '—'} />
                <DetailRow label="Tenant Since" value={tenant.moveInDate ?? '—'} />
              </>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-hint)', padding:'8px 0' }}>Vacant — no tenant assigned</div>
            )}
          </SectionCard>

          {/* Vehicles */}
          <SectionCard accentColor="#D97706" iconBg="#FEF3C7" icon="ti-car" title="Vehicle Details" subtitle={(entry.vehicles ?? []).map((v:any)=>v.plateNumber).join(' ') || 'No vehicles'}>
            {(entry.vehicles ?? []).length > 0 ? (
              <>
                <DetailRow label="Vehicle No."  value={(entry.vehicles ?? []).map((v:any)=>v.plateNumber).join(', ')} />
                <DetailRow label="Vehicle Type" value={(entry.vehicles ?? []).map((v:any)=>v.type).join(', ')} />
                <div style={{ marginTop:10 }}>
                  <button onClick={()=>router.push('/vehicles')} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600, background:'var(--gray-50)', border:'1px solid var(--border)', color:'var(--text-muted)', cursor:'pointer' }}>
                    <i className="ti ti-edit" aria-hidden style={{ fontSize:12 }} />Edit Vehicles
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-hint)', padding:'8px 0' }}>No vehicles listed</div>
            )}
          </SectionCard>

          {/* Payment stats — full width */}
          <div style={{ gridColumn:'1 / -1', display:'flex', gap:14 }}>
            <StatBadge value={paidCount}    label="months paid"        color={T.greenText} bg={T.greenBg} />
            <StatBadge value={pendingCount} label="months outstanding" color={T.redText}   bg={T.redBg}   />
            <StatBadge value={partialCount} label="partial payments"   color={T.blueText}  bg={T.blueBg}  />
            <StatBadge value={totalCount}   label="all time"           color={T.blueText}  bg="#EFF6FF"   />
          </div>

          {/* Pending alert */}
          {pendingCount > 0 && (
            <div style={{ gridColumn:'1 / -1', display:'flex', alignItems:'center', gap:10, background:T.amberBg, border:'1px solid #FDE68A', borderRadius:12, padding:'12px 16px', color:T.amberText, fontWeight:600, fontSize:13 }}>
              <i className="ti ti-alert-triangle" aria-hidden style={{ fontSize:18, flexShrink:0 }} />
              {pendingCount} pending payment{pendingCount !== 1 ? 's' : ''} need to be collected
            </div>
          )}

          {/* Payment History table — full width */}
          <div style={{ gridColumn:'1 / -1', background:'white', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ borderTop:'3px solid #2563EB', padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:9, background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className="ti ti-credit-card" aria-hidden style={{ fontSize:15, color:'#2563EB' }} />
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Payment History</div>
              </div>

              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <select value={payYear} onChange={e=>setPayYear(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, color:'var(--text-muted)', background:'var(--gray-50)', fontFamily:'inherit', cursor:'pointer' }}>
                  <option>All Years</option>
                  {availableYears.map(y=><option key={y}>{y}</option>)}
                </select>
                <select value={payStatus} onChange={e=>setPayStatus(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', fontSize:12, color:'var(--text-muted)', background:'var(--gray-50)', fontFamily:'inherit', cursor:'pointer' }}>
                  <option>All Statuses</option>
                  <option>PAID</option>
                  <option>PENDING</option>
                  <option>PARTIAL</option>
                </select>
                <span style={{ fontSize:12, color:'var(--text-muted)', background:'var(--gray-100)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 10px', fontWeight:600 }}>
                  {filteredPayments.length} records
                </span>
              </div>
            </div>

            {payLoading ? (
              <div style={{ padding:'32px', textAlign:'center' as const, color:'var(--text-muted)', fontSize:13 }}>
                <i className="ti ti-loader-2" aria-hidden style={{ fontSize:24, display:'block', marginBottom:8, color:T.brand, animation:'spin 1s linear infinite' }} />
                Loading payment records…
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1.5fr 1.5fr 1fr 80px', background:'var(--gray-50)', borderBottom:'1px solid var(--border)', padding:'10px 18px', gap:0 }}>
                  {['MONTH / YEAR','AMOUNT (₹)','PAYMENT DATE','MODE','MONTHS COVERED','REMARKS','STATUS',''].map((h,i)=>(
                    <div key={i} style={{ fontSize:10, fontWeight:700, color:'var(--text-hint)', letterSpacing:'.07em', textTransform:'uppercase' as const }}>{h}</div>
                  ))}
                </div>

                <div style={{ maxHeight:380, overflowY:'auto' as const }}>
                  {filteredPayments.length === 0 && (
                    <div style={{ padding:'32px 18px', textAlign:'center' as const, fontSize:13, color:'var(--text-hint)' }}>
                      No payment records match your filters
                    </div>
                  )}
                  {filteredPayments.map((p, i) => {
                    const ps = PAY_BADGE[p.status] ?? PAY_BADGE.PENDING
                    return (
                      <div key={p.id}
                        style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1.5fr 1.5fr 1fr 80px', alignItems:'center', padding:'14px 18px', borderBottom:i<filteredPayments.length-1?'1px solid var(--border)':'none', background:'white', transition:'background .12s', gap:0 }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--gray-50)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='white')}
                      >
                        <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{p.billingMonth}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:p.totalAmount ? 'var(--text)' : 'var(--text-hint)' }}>
                          {p.totalAmount ? `₹${Number(p.totalAmount).toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day:'2-digit', month:'numeric', year:'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{p.mode ?? '—'}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)' }}>{p.monthsCovered ?? '—'}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, maxWidth:160 }}>{p.remarks ?? '—'}</div>
                        <div>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:ps.bg, color:ps.color }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:ps.color, display:'inline-block' }} />
                            {p.status === 'PAID' ? 'Paid' : p.status === 'PARTIAL' ? 'Partial' : 'Pending'}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={()=>setRecording(p)} style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--border)', background:'var(--gray-50)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'var(--text-muted)' }}>
                            <i className="ti ti-edit" aria-hidden style={{ fontSize:13 }} />
                          </button>
                          <button style={{ width:28, height:28, borderRadius:7, border:'1px solid #FEE2E2', background:'#FFF5F5', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.redText }}>
                            <i className="ti ti-trash" aria-hidden style={{ fontSize:13 }} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Record payment modal — above the full-page panel */}
      {recording && (
        <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.45)' }} onClick={()=>setRecording(null)}>
          <div style={{ position:'relative', width:'100%', maxWidth:380, background:'white', borderRadius:16, padding:'20px', boxShadow:'0 20px 60px -12px rgba(0,0,0,0.22)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--text)' }}>Record Payment</div>
              <button onClick={()=>setRecording(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
                <i className="ti ti-x" style={{ fontSize:18 }} />
              </button>
            </div>

            <div style={{ background:T.brandLight, border:`1px solid ${T.brandMid}`, borderRadius:12, padding:'12px 14px', marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{flatBlock} · Flat {flatNum}</div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{recording.billingMonth}</div>
              <div style={{ fontSize:20, fontWeight:700, color:T.brand, marginTop:6 }}>₹{Number(recording.totalAmount).toLocaleString('en-IN')}</div>
            </div>

            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' as const, letterSpacing:'.06em', marginBottom:8 }}>Payment mode</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                {['CASH','UPI','ONLINE'].map(m=>(
                  <button key={m} onClick={()=>setMode(m)} style={{ padding:8, borderRadius:9, fontSize:12, fontWeight:600, cursor:'pointer', background:mode===m?T.brand:'var(--gray-50)', color:mode===m?'#fff':'var(--text-muted)', border:`1px solid ${mode===m?T.brand:'var(--border)'}` }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase' as const, letterSpacing:'.06em', marginBottom:8 }}>Late fee (₹)</div>
              <input type="number" style={inputStyle} placeholder="0" value={lateFee} onChange={e=>setLateFee(Number(e.target.value))} />
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setRecording(null)} style={{ flex:1, padding:10, borderRadius:10, background:'var(--gray-100)', color:'var(--text)', border:'1px solid var(--border)', fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
              <button onClick={handleRecord} disabled={saving} style={{ flex:1, padding:10, borderRadius:10, background:T.brand, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
                {saving ? 'Saving…' : `Confirm ₹${(Number(recording.totalAmount)+lateFee).toLocaleString('en-IN')}`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </>,
    document.body
  )
}