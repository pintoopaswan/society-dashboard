"use client"
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { searchAll, api, Payment } from '@/lib/api'

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
  surface:    'var(--surface)',
  border:     'var(--border)',
  text:       'var(--text)',
  muted:      'var(--text-muted)',
  hint:       'var(--text-hint)',
}

const ROLE_BADGE: Record<string, { bg: string; color: string; dot: string }> = {
  Owner:  { bg: T.tealBg,  color: T.tealText,  dot: '#14B8A6' },
  Tenant: { bg: T.blueBg,  color: T.blueText,  dot: '#3B82F6' },
}
const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  OWNER_OCCUPIED: { bg: T.tealBg,  color: T.tealText,  label: 'Owner Occupied'   },
  RENTED:         { bg: T.blueBg,  color: T.blueText,  label: 'Tenant Occupied'  },
  TENANT:         { bg: T.blueBg,  color: T.blueText,  label: 'Tenant'           },
  VACANT:         { bg: T.grayBg,  color: T.grayText,  label: 'Vacant'           },
  LOCKED:         { bg: T.redBg,   color: T.redText,   label: 'Locked'           },
}
const PAY_BADGE: Record<string, { bg: string; color: string }> = {
  PAID:    { bg: T.greenBg,  color: T.greenText  },
  PENDING: { bg: T.amberBg, color: T.amberText },
  OVERDUE: { bg: T.redBg,   color: T.redText   },
  PARTIAL: { bg: T.blueBg,  color: T.blueText   },
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function Badge({ label, bg, color, dot }: { label: string; bg: string; color: string; dot?: string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:bg, color, whiteSpace:'nowrap' as const }}>
      {dot && <span style={{ width:5, height:5, borderRadius:'50%', background:dot, display:'inline-block', flexShrink:0 }} />}
      {label}
    </span>
  )
}

function Avatar({ name, size=36, bg=T.tealBg, color=T.tealText, border=T.brandMid }: { name?:string; size?:number; bg?:string; color?:string; border?:string }) {
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, border:`2px solid ${border}`, color, fontWeight:700, fontSize:Math.round(size*0.38), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, letterSpacing:'.01em' }}>
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  )
}

function DetailRow({ icon, label, value }: { icon:string; label:string; value:React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid var(--border)` }}>
      <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:12, color:T.muted }}>
        <i className={`ti ${icon}`} aria-hidden style={{ fontSize:13, width:14, color:T.hint }} />{label}
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:T.text, textAlign:'right' as const, maxWidth:'60%', wordBreak:'break-word' as const }}>{value}</div>
    </div>
  )
}

function SectionCard({ icon, iconColor, accentColor, title, subtitle, editLabel, onEdit, children }: {
  icon:string; iconColor:string; accentColor:string; title:string; subtitle?:string;
  editLabel?:string; onEdit?:()=>void; children:React.ReactNode
}) {
  return (
    <div style={{ background:'white', border:`1px solid var(--border)`, borderRadius:14, overflow:'hidden' }}>
      <div style={{ borderTop:`3px solid ${accentColor}`, padding:'14px 18px 12px', borderBottom:`1px solid var(--border)`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:10, background:`${iconColor}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className={`ti ${icon}`} aria-hidden style={{ fontSize:16, color:iconColor }} />
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{title}</div>
            {subtitle && <div style={{ fontSize:11, color:T.muted, marginTop:1 }}>{subtitle}</div>}
          </div>
        </div>
        {editLabel && onEdit && (
          <button onClick={onEdit} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:8, fontSize:12, fontWeight:600, background:'var(--gray-50)', border:`1px solid var(--border)`, color:T.muted, cursor:'pointer' }}>
            <i className="ti ti-edit" aria-hidden style={{ fontSize:12 }} />{editLabel}
          </button>
        )}
      </div>
      <div style={{ padding:'14px 18px' }}>{children}</div>
    </div>
  )
}

function StatCard({ value, label, color, bg }: { value:string|number; label:string; color:string; bg:string }) {
  return (
    <div style={{ background:bg, borderRadius:12, padding:'14px 16px', border:`1px solid ${color}30`, flex:1, minWidth:0 }}>
      <div style={{ fontSize:28, fontWeight:800, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:T.muted, marginTop:4, fontWeight:500 }}>{label}</div>
    </div>
  )
}

function ModalShell({ title, maxWidth=480, onClose, children }: { title:string; maxWidth?:number; onClose:()=>void; children:React.ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div style={{ position:'fixed', inset:0, zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:'rgba(0,0,0,0.40)' }} onClick={onClose}>
      <div style={{ position:'relative', width:'100%', maxWidth, background:'var(--surface,white)', border:`1px solid var(--border)`, borderRadius:16, padding:'18px 20px', boxShadow:'0 20px 60px -12px rgba(0,0,0,0.28)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:T.text }}>{title}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.muted, padding:4, borderRadius:6, lineHeight:1 }} aria-label="Close">
            <i className="ti ti-x" style={{ fontSize:18 }} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

// ─── Full-page Detail Panel (replaces the side drawer) ────────────────────────
function DetailPanel({ entry, enriching=false, onClose, onPaymentRecorded }: { entry:any; enriching?:boolean; onClose:()=>void; onPaymentRecorded:()=>void }) {
  const [payments,setPayments]           = useState<Payment[]>([])
  const [payLoading,setPayLoading]       = useState(true)
  const [recording,setRecording]         = useState<Payment|null>(null)
  const [mode,setMode]                   = useState('CASH')
  const [lateFee,setLateFee]             = useState(0)
  const [saving,setSaving]               = useState(false)
  const [showEditModal,setShowEditModal] = useState(false)
  const [editPerson,setEditPerson]       = useState<any|null>(null)
  const [showVehiclesModal,setShowVehiclesModal] = useState(false)
  const [vehicleAdding,setVehicleAdding] = useState(false)
  const [newVehicle,setNewVehicle]       = useState({ type:'CAR', plateNumber:'', make:'', model:'', color:'' })
  const [payYear,setPayYear]             = useState('All Years')
  const [payStatus,setPayStatus]         = useState('All Statuses')

  // Safe-guard: entry may be any shape from search results
  const safeEntry = entry ?? {}
  const person   = safeEntry.person   ?? null
  const flat     = safeEntry.flat     ?? null
  const role     = safeEntry.role     ?? null
  const vehicles = safeEntry.vehicles ?? []
  const vehicle  = safeEntry.vehicle  ?? null

  const tryOP = (o:any) => o?.person ?? (o?.personId ? { id:o.personId, name:o.personName ?? 'Owner'  } : null)
  const tryTP = (t:any) => t?.person ?? (t?.personId ? { id:t.personId, name:t.personName ?? 'Tenant' } : null)

  let owner:any=null, tenant:any=null
  if (safeEntry.ownerships?.length)        owner  = tryOP(safeEntry.ownerships[0])
  if (safeEntry.tenancies?.length)         tenant = tryTP(safeEntry.tenancies[0])
  if (!owner  && flat?.ownerships?.length) owner  = tryOP(flat.ownerships[0])
  if (!tenant && flat?.tenancies?.length)  tenant = tryTP(flat.tenancies[0])
  if (person) {
    const pid = person.id
    if (!owner  && (person.ownerships?.some((o:any)=>o.flatId===flat?.id) || safeEntry.ownerships?.some((o:any)=>o.personId===pid))) owner=person
    if (!tenant && (person.tenancies?.some((t:any) =>t.flatId===flat?.id) || safeEntry.tenancies?.some((t:any) =>t.personId===pid))) tenant=person
  }
  if (role==='Owner'  && !owner  && person) owner=person
  if (role==='Tenant' && !tenant && person) tenant=person
  if (!owner && !tenant && safeEntry.person) owner=safeEntry.person

  const personVehicles = (owner?.id===person?.id ? person?.vehicles : null) ?? (tenant?.id===person?.id ? person?.vehicles : null)
  const allVehicles:any[] = vehicles?.length ? vehicles : (personVehicles ?? person?.vehicles ?? (vehicle ? [vehicle] : []))

  const tenancy     = safeEntry.tenancies?.[0] ?? flat?.tenancies?.[0]
  const occKey      = flat?.status ?? (tenancy ? 'RENTED' : flat?.ownerships?.length ? 'OWNER_OCCUPIED' : 'VACANT')
  const occMeta     = STATUS_BADGE[occKey] ?? STATUS_BADGE.VACANT

  const flatLabel   = flat ? `${flat.block?.name ?? flat.block} / Flat ${flat.flatNumber}` : ''
  const flatCode    = flat ? `${(flat.block?.name ?? flat.block)?.replace('Block-','B') ?? 'B'}-${flat.flatNumber}` : ''

  const loadPayments = useCallback(async () => {
    if (!flat?.id) { setPayLoading(false); return }
    setPayLoading(true)
    try {
      const p = await api.getPayments(`?flatId=${flat.id}`)
      setPayments(p.sort((a:Payment,b:Payment)=>b.billingMonth.localeCompare(a.billingMonth)))
    } catch(e){ console.error(e) } finally { setPayLoading(false) }
  }, [flat?.id])

  useEffect(() => { loadPayments() }, [loadPayments])

  const handleRecord = async () => {
    if (!recording) return
    setSaving(true)
    try { await api.recordPayment(recording.id,{mode,lateFee}); setRecording(null); setLateFee(0); await loadPayments(); onPaymentRecorded() }
    finally { setSaving(false) }
  }

  const saveEdit = async () => {
    if (!editPerson?.id) return
    setSaving(true)
    try { await api.updateResident(editPerson.id,{ name:editPerson.name, phone:editPerson.phone, altPhone:editPerson.altPhone, email:editPerson.email, aadhaarLast4:editPerson.aadhaarLast4, panNumber:editPerson.panNumber }); setShowEditModal(false) }
    catch(e:any){ alert(e.message||'Update failed') } finally { setSaving(false) }
  }

  const handleAddVehicle = async () => {
    const rid = person?.id ?? owner?.id ?? tenant?.id
    if (!rid) return alert('Cannot determine resident')
    setVehicleAdding(true)
    try {
      await api.addVehicle(rid,{ flatId:flat?.id, type:newVehicle.type, plateNumber:newVehicle.plateNumber, make:newVehicle.make, model:newVehicle.model, color:newVehicle.color })
      setNewVehicle({ type:'CAR', plateNumber:'', make:'', model:'', color:'' })
      setShowVehiclesModal(false)
    } catch(e:any){ alert(e.message||'Failed to add vehicle') } finally { setVehicleAdding(false) }
  }

  const paidCount    = payments.filter(p=>p.status==='PAID').length
  const pendingCount = payments.filter(p=>p.status==='PENDING'||p.status==='OVERDUE').length
  const partialCount = payments.filter(p=>p.status==='PARTIAL').length
  const totalCount   = payments.length

  const availableYears = [...new Set(payments.map(p=>p.billingMonth?.split(' ')[1]).filter(Boolean))].sort().reverse()

  const filteredPayments = payments.filter(p => {
    const yearOk   = payYear === 'All Years' || p.billingMonth?.includes(payYear)
    const statusOk = payStatus === 'All Statuses' || p.status === payStatus
    return yearOk && statusOk
  })

  const inputStyle = { padding:'10px 12px', borderRadius:10, border:`1.5px solid var(--border)`, fontSize:13, color:T.text, background:'var(--gray-50)', fontFamily:'inherit', outline:'none', width:'100%' } as React.CSSProperties

  // Portal: must mount to body to escape any parent transform / overflow that breaks position:fixed
  if (typeof document === 'undefined') return null

  const SIDEBAR = 240 // px — matches the app sidebar width

  return createPortal(
    <>
      {/* Dim overlay — content area only, sidebar stays visible */}
      <div style={{ position:'fixed', top:0, left:SIDEBAR, right:0, bottom:0, zIndex:9998, background:'rgba(0,0,0,0.35)' }} onClick={onClose} />

      {/* Detail panel — fills the content area beside the sidebar */}
      <div style={{ position:'fixed', top:0, left:SIDEBAR, right:0, bottom:0, zIndex:9999, display:'flex', flexDirection:'column', overflowY:'auto', background:'var(--gray-50,#F9FAFB)' }} onClick={e=>e.stopPropagation()}>

        {/* Top bar */}
        <div style={{ background:'white', borderBottom:`1px solid var(--border)`, padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, position:'sticky', top:0, zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:T.text }}>Flat Search</div>
              <div style={{ fontSize:12, color:T.muted, marginTop:1 }}>MIG Society, Sector-29 · Resident profile &amp; payment history</div>
            </div>
            {enriching && (
              <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:T.brandLight, color:T.brand, border:`1px solid ${T.brandMid}` }}>
                <i className="ti ti-loader-2" aria-hidden style={{ fontSize:12, animation:'spin 1s linear infinite' }} />
                Loading details…
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:9, fontSize:13, fontWeight:600, background:'var(--gray-100)', border:`1px solid var(--border)`, color:T.text, cursor:'pointer' }}>
            <i className="ti ti-x" aria-hidden style={{ fontSize:14 }} />Close
          </button>
        </div>

        {/* Flat badge + summary row */}
        <div style={{ padding:'20px 24px 0' }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' as const }}>
            <div style={{ background:T.purple, color:'white', fontWeight:800, fontSize:15, borderRadius:12, padding:'10px 18px', letterSpacing:'.02em' }}>
              <i className="ti ti-home-2" aria-hidden style={{ fontSize:14, marginRight:6 }} />{flatCode}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:18, fontWeight:800, color:T.text, letterSpacing:'-.01em' }}>{flatLabel}</div>
              <div style={{ fontSize:12, color:T.muted, marginTop:3, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' as const }}>
                {!payLoading && <span>{totalCount} payment records</span>}
                {owner && <span>· {owner.name}</span>}
                {tenant && <span>· Tenant: {tenant.name}</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:10, fontSize:13, fontWeight:600, background:'white', border:`1px solid var(--border)`, color:T.muted, cursor:'pointer' }}>
              <i className="ti ti-x" aria-hidden style={{ fontSize:14 }} />Close
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div style={{ padding:'20px 24px 32px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

          {/* Flat Information */}
          <SectionCard icon="ti-home-2" iconColor="#0F766E" accentColor="#0F766E" title="Flat Information" subtitle={`${flat?.flatNumber} · ${flat?.block?.name ?? flat?.block}`}>
            <DetailRow icon="ti-building" label="Block"   value={flat?.block?.name ?? flat?.block ?? '—'} />
            <DetailRow icon="ti-hash"     label="Flat No." value={flat?.flatNumber ?? '—'} />
            <DetailRow icon="ti-car"      label="Type"    value={allVehicles.length > 0 ? allVehicles.map((v:any)=>v.type).join(', ') : '—'} />
            <DetailRow icon="ti-info-circle" label="Status" value={
              <Badge label={occMeta.label} bg={occMeta.bg} color={occMeta.color} />
            } />
          </SectionCard>

          {/* Owner Details */}
          <SectionCard icon="ti-user-circle" iconColor="#0F766E" accentColor="#0F766E" title="Owner Details" subtitle={owner?.name ?? 'No owner'} editLabel="Edit" onEdit={()=>{ if(owner){setEditPerson(owner);setShowEditModal(true)} }}>
            {owner ? (
              <>
                <DetailRow icon="ti-user"    label="Name"          value={owner.name} />
                <DetailRow icon="ti-phone"   label="Mobile"        value={<a href={`tel:${owner.phone}`} style={{ color:T.brand, fontWeight:600, textDecoration:'none' }}>{owner.phone}</a>} />
                <DetailRow icon="ti-mail"    label="Email"         value={owner.email ?? '—'} />
                <DetailRow icon="ti-map-pin" label="City/Location" value={owner.address ?? '—'} />
              </>
            ) : (
              <div style={{ fontSize:12, color:T.hint, padding:'8px 0' }}>No owner information available</div>
            )}
          </SectionCard>

          {/* Tenant Details */}
          <SectionCard icon="ti-users" iconColor="#2563EB" accentColor="#2563EB" title="Tenant Details" subtitle={tenant ? `Occupied by ${tenant.name}` : 'Vacant'} editLabel={tenant ? 'Edit' : undefined} onEdit={()=>{ if(tenant){setEditPerson(tenant);setShowEditModal(true)} }}>
            {tenant ? (
              <>
                <DetailRow icon="ti-user"     label="Name"         value={tenant.name} />
                <DetailRow icon="ti-phone"    label="Mobile"       value={<a href={`tel:${tenant.phone}`} style={{ color:T.brand, fontWeight:600, textDecoration:'none' }}>{tenant.phone}</a>} />
                <DetailRow icon="ti-mail"     label="Email"        value={tenant.email ?? '—'} />
                <DetailRow icon="ti-calendar" label="Tenant Since" value={tenancy?.startDate ?? '—'} />
              </>
            ) : (
              <div style={{ fontSize:12, color:T.hint, padding:'8px 0' }}>Vacant — no tenant assigned</div>
            )}
          </SectionCard>

          {/* Vehicle Details */}
          <SectionCard icon="ti-car" iconColor="#D97706" accentColor="#D97706" title="Vehicle Details" subtitle={allVehicles.map((v:any)=>v.plateNumber).join(' ') || 'No vehicles'}>
            {allVehicles.length > 0 ? (
              <>
                <DetailRow icon="ti-hash"    label="Vehicle No."  value={allVehicles.map((v:any)=>v.plateNumber).join(', ')} />
                <DetailRow icon="ti-car"     label="Vehicle Type" value={allVehicles.map((v:any)=>v.type).join(', ')} />
                <div style={{ marginTop:10 }}>
                  <button onClick={()=>setShowVehiclesModal(true)} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600, background:'var(--gray-50)', border:`1px solid var(--border)`, color:T.muted, cursor:'pointer' }}>
                    <i className="ti ti-plus" aria-hidden style={{ fontSize:12 }} />Add Vehicle
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize:12, color:T.hint, padding:'8px 0' }}>
                No vehicles listed.
                <button onClick={()=>setShowVehiclesModal(true)} style={{ marginLeft:8, background:'none', border:'none', color:T.brand, fontSize:12, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>Add one</button>
              </div>
            )}
          </SectionCard>

          {/* Payment stats — full width */}
          <div style={{ gridColumn:'1 / -1', display:'flex', gap:14 }}>
            <StatCard value={paidCount}    label="months paid"          color={T.greenText} bg={T.greenBg} />
            <StatCard value={pendingCount} label="months outstanding"   color={T.redText}   bg={T.redBg}   />
            <StatCard value={partialCount} label="partial payments"     color={T.blueText}  bg={T.blueBg}  />
            <StatCard value={totalCount}   label="all time"             color={T.blueText}  bg="#EFF6FF"   />
          </div>

          {/* Pending alert */}
          {pendingCount > 0 && (
            <div style={{ gridColumn:'1 / -1', display:'flex', alignItems:'center', gap:10, background:T.amberBg, border:`1px solid #FDE68A`, borderRadius:12, padding:'12px 16px', color:T.amberText, fontWeight:600, fontSize:13 }}>
              <i className="ti ti-alert-triangle" aria-hidden style={{ fontSize:18, flexShrink:0 }} />
              {pendingCount} pending payment{pendingCount !== 1 ? 's' : ''} need to be collected
            </div>
          )}

          {/* Payment History — full width */}
          <div style={{ gridColumn:'1 / -1', background:'white', border:`1px solid var(--border)`, borderRadius:14, overflow:'hidden' }}>
            <div style={{ borderTop:`3px solid #2563EB`, padding:'14px 18px', borderBottom:`1px solid var(--border)`, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap' as const, gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:10, background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className="ti ti-credit-card" aria-hidden style={{ fontSize:16, color:'#2563EB' }} />
                </div>
                <div style={{ fontSize:13, fontWeight:700, color:T.text }}>Payment History</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {/* Year filter */}
                <select value={payYear} onChange={e=>setPayYear(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:`1px solid var(--border)`, fontSize:12, color:T.muted, background:'var(--gray-50)', fontFamily:'inherit', cursor:'pointer' }}>
                  <option>All Years</option>
                  {availableYears.map(y=><option key={y}>{y}</option>)}
                </select>
                {/* Status filter */}
                <select value={payStatus} onChange={e=>setPayStatus(e.target.value)} style={{ padding:'6px 10px', borderRadius:8, border:`1px solid var(--border)`, fontSize:12, color:T.muted, background:'var(--gray-50)', fontFamily:'inherit', cursor:'pointer' }}>
                  <option>All Statuses</option>
                  <option>PAID</option>
                  <option>PENDING</option>
                  <option>PARTIAL</option>
                </select>
                <span style={{ fontSize:12, color:T.muted, background:'var(--gray-100)', border:`1px solid var(--border)`, borderRadius:8, padding:'6px 10px', fontWeight:600 }}>
                  {filteredPayments.length} record{filteredPayments.length!==1?'s':''}
                </span>
              </div>
            </div>

            {payLoading ? (
              <div style={{ padding:'32px 18px', textAlign:'center' as const, color:T.muted, fontSize:13 }}>
                <i className="ti ti-loader-2" aria-hidden style={{ fontSize:24, display:'block', marginBottom:8, color:T.brand, animation:'spin 1s linear infinite' }} />
                Loading payment records…
              </div>
            ) : (
              <>
                {/* Table header */}
                <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1.5fr 1.5fr 1fr 80px', gap:0, background:'var(--gray-50)', borderBottom:`1px solid var(--border)`, padding:'10px 18px' }}>
                  {['MONTH / YEAR','AMOUNT (₹)','PAYMENT DATE','MODE','MONTHS COVERED','REMARKS','STATUS',''].map((h,i)=>(
                    <div key={i} style={{ fontSize:10, fontWeight:700, color:T.hint, letterSpacing:'.07em', textTransform:'uppercase' as const }}>{h}</div>
                  ))}
                </div>

                <div style={{ maxHeight:360, overflowY:'auto' as const }}>
                  {filteredPayments.length === 0 && (
                    <div style={{ padding:'32px 18px', textAlign:'center' as const, fontSize:13, color:T.hint }}>
                      No payment records match your filters
                    </div>
                  )}
                  {filteredPayments.map((p,i)=>{
                    const ps = PAY_BADGE[p.status] ?? PAY_BADGE.PENDING
                    return (
                      <div key={p.id} style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1fr 1.5fr 1.5fr 1fr 80px', alignItems:'center', gap:0, padding:'14px 18px', borderBottom:i<filteredPayments.length-1?`1px solid var(--border)`:'none', background:'white', transition:'background .12s' }}
                        onMouseEnter={e=>(e.currentTarget.style.background='var(--gray-50)')}
                        onMouseLeave={e=>(e.currentTarget.style.background='white')}
                      >
                        <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{p.billingMonth}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:p.totalAmount ? T.text : T.hint }}>{p.totalAmount ? `₹${Number(p.totalAmount).toLocaleString('en-IN')}` : '—'}</div>
                        <div style={{ fontSize:12, color:T.muted }}>{p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN') : '—'}</div>
                        <div style={{ fontSize:12, color:T.muted }}>{p.mode ?? '—'}</div>
                        <div style={{ fontSize:12, color:T.muted }}>{p.monthsCovered ?? '—'}</div>
                        <div style={{ fontSize:12, color:T.muted, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{p.remarks ?? '—'}</div>
                        <div>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:ps.bg, color:ps.color }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:ps.color, display:'inline-block', flexShrink:0 }} />
                            {p.status === 'PAID' ? 'Paid' : p.status === 'PARTIAL' ? 'Partial' : 'Pending'}
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:4 }}>
                          <button onClick={()=>setRecording(p)} style={{ width:28, height:28, borderRadius:7, border:`1px solid var(--border)`, background:'var(--gray-50)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.muted }}>
                            <i className="ti ti-edit" aria-hidden style={{ fontSize:13 }} />
                          </button>
                          <button style={{ width:28, height:28, borderRadius:7, border:`1px solid #FEE2E2`, background:'#FFF5F5', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.redText }}>
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

      {/* Record payment modal */}
      {recording && (
        <ModalShell title="Record Payment" maxWidth={380} onClose={()=>setRecording(null)}>
          <div style={{ background:T.brandLight, border:`1px solid ${T.brandMid}`, borderRadius:12, padding:'12px 14px', marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{flat?.block?.name??flat?.block} · Flat {flat?.flatNumber}</div>
            <div style={{ fontSize:12, color:T.muted, marginTop:2 }}>{recording.billingMonth}</div>
            <div style={{ fontSize:20, fontWeight:700, color:T.brand, marginTop:6 }}>₹{Number(recording.totalAmount).toLocaleString('en-IN')}</div>
          </div>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.muted, textTransform:'uppercase' as const, letterSpacing:'.06em', marginBottom:8 }}>Payment mode</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {['CASH','UPI','ONLINE'].map(m=>(
                <button key={m} onClick={()=>setMode(m)} style={{ padding:8, borderRadius:9, fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s', background:mode===m?T.brand:'var(--gray-50)', color:mode===m?'#fff':T.muted, border:`1px solid ${mode===m?T.brand:'var(--border)'}` }}>{m}</button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:600, color:T.muted, textTransform:'uppercase' as const, letterSpacing:'.06em', marginBottom:8 }}>Late fee (₹)</div>
            <input type="number" style={inputStyle} placeholder="0" value={lateFee} onChange={e=>setLateFee(Number(e.target.value))} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>setRecording(null)} style={{ flex:1, padding:10, borderRadius:10, background:'var(--gray-100)', color:T.text, border:`1px solid var(--border)`, fontSize:13, fontWeight:600, cursor:'pointer' }}>Cancel</button>
            <button onClick={handleRecord} disabled={saving} style={{ flex:1, padding:10, borderRadius:10, background:T.brand, color:'#fff', border:'none', fontSize:13, fontWeight:600, cursor:saving?'not-allowed':'pointer', opacity:saving?.7:1 }}>
              {saving ? 'Saving…' : `Confirm ₹${(Number(recording.totalAmount)+lateFee).toLocaleString('en-IN')}`}
            </button>
          </div>
        </ModalShell>
      )}

      {/* Edit resident modal */}
      {showEditModal && editPerson && (
        <ModalShell title="Edit Resident" maxWidth={520} onClose={()=>setShowEditModal(false)}>
          <div style={{ display:'grid', gap:10 }}>
            {[{key:'name',ph:'Full name',type:'text'},{key:'phone',ph:'Phone',type:'tel'},{key:'altPhone',ph:'Alternate phone',type:'tel'},{key:'email',ph:'Email',type:'email'}].map(f=>(
              <input key={f.key} type={f.type} value={(editPerson as any)[f.key]||''} onChange={e=>setEditPerson({...editPerson,[f.key]:e.target.value})} placeholder={f.ph} style={inputStyle} />
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <input value={editPerson.aadhaarLast4||''} onChange={e=>setEditPerson({...editPerson,aadhaarLast4:e.target.value})} placeholder="Aadhaar (last 4)" maxLength={4} style={inputStyle} />
              <input value={editPerson.panNumber||''} onChange={e=>setEditPerson({...editPerson,panNumber:e.target.value.toUpperCase()})} placeholder="PAN number" style={inputStyle} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
              <button onClick={()=>setShowEditModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={saveEdit} className="btn-primary" disabled={saving}>{saving?'Saving…':'Save changes'}</button>
            </div>
          </div>
        </ModalShell>
      )}

      {/* Vehicles modal */}
      {showVehiclesModal && (
        <ModalShell title="Add Vehicle" maxWidth={500} onClose={()=>setShowVehiclesModal(false)}>
          <div style={{ display:'grid', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <select value={newVehicle.type} onChange={e=>setNewVehicle({...newVehicle,type:e.target.value})} style={inputStyle}>
                {['CAR','BIKE','SCOOTER','CYCLE','OTHER'].map(t=><option key={t}>{t}</option>)}
              </select>
              <input value={newVehicle.plateNumber} onChange={e=>setNewVehicle({...newVehicle,plateNumber:e.target.value.toUpperCase()})} placeholder="Registration number" style={inputStyle} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <input value={newVehicle.make}  onChange={e=>setNewVehicle({...newVehicle,make:e.target.value})}  placeholder="Make (e.g. Maruti)" style={inputStyle} />
              <input value={newVehicle.model} onChange={e=>setNewVehicle({...newVehicle,model:e.target.value})} placeholder="Model (e.g. Swift)"  style={inputStyle} />
            </div>
            <input value={newVehicle.color} onChange={e=>setNewVehicle({...newVehicle,color:e.target.value})} placeholder="Color" style={inputStyle} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:4 }}>
              <button onClick={()=>setShowVehiclesModal(false)} className="btn-ghost">Cancel</button>
              <button onClick={handleAddVehicle} disabled={vehicleAdding||!newVehicle.plateNumber} className="btn-primary">{vehicleAdding?'Adding…':'Add Vehicle'}</button>
            </div>
          </div>
        </ModalShell>
      )}

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </>,
    document.body
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const LIMIT = 40

// Parse "1-103" → block=1, flat=103 or "B1-103" → same
function parseBlockFlat(q: string): { block?: string; flat?: string } | null {
  // Patterns: "1-103", "B1-103", "B-1-103", "block1-103", "1 103"
  const m =
    q.match(/^(?:block[- ]?)?([a-zA-Z]?\d+)[- ](\d+)$/i) ||
    q.match(/^([a-zA-Z]-?\d+)[- ](\d+)$/i)
  if (m) return { block: m[1], flat: m[2] }
  return null
}

export default function SearchPage() {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<any[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [error,    setError]    = useState('')
  const [selected,  setSelected]  = useState<any|null>(null)
  const [enriching, setEnriching] = useState(false)
  const [offset,   setOffset]   = useState(0)
  const [hasMore,  setHasMore]  = useState(false)
  const [stats,    setStats]    = useState<{totalFlats:number;occupied:number;paymentRecords:number}|null>(null)

  const inputRef      = useRef<HTMLInputElement>(null)
  const controllerRef = useRef<AbortController|null>(null)

  // Normalise any raw search result so DetailPanel never gets undefined fields
  const normalise = (e: any) => ({
    person:     e?.person     ?? null,
    flat:       e?.flat       ?? null,
    role:       e?.role       ?? null,
    vehicles:   e?.vehicles   ?? [],
    vehicle:    e?.vehicle    ?? null,
    ownerships: e?.ownerships ?? [],
    tenancies:  e?.tenancies  ?? [],
  })

  useEffect(()=>{ inputRef.current?.focus() },[])

  // Load stats once
  useEffect(()=>{
    api.getStats?.().then(setStats).catch(()=>{})
  },[])

  useEffect(()=>{
    try {
      const raw = localStorage.getItem('globalSearchSelected')
      if (!raw) return
      const payload = JSON.parse(raw)
      localStorage.removeItem('globalSearchSelected')
      const norm = normalise(payload)
      setSelected(norm); setSearched(true); setResults(norm ? [norm] : [])
    } catch { /* ignore */ }
  },[])

  // Use a ref for offset so doSearch closure never goes stale
  const offsetRef = useRef(0)

  // Simple in-memory cache: key → {resident, flat} to avoid re-fetching on re-click
  const residentCache = useRef<Map<string,any>>(new Map())
  const flatCache     = useRef<Map<string,any>>(new Map())

  const doSearch = useCallback(async (q:string, append=false)=>{
    if (!q||q.length<2) { setResults([]); setSearched(false); setHasMore(false); offsetRef.current=0; setOffset(0); return }
    controllerRef.current?.abort()
    const ctl = new AbortController()
    controllerRef.current = ctl
    if (!append) { setLoading(true); setError('') }
    try {
      const currentOffset = append ? offsetRef.current : 0
      const res = await searchAll(q,{ limit:LIMIT, offset:currentOffset },{ signal:ctl.signal })
      if (append) setResults(prev=>[...prev,...res]); else setResults(res)
      setSearched(true); setHasMore(res.length===LIMIT)
      offsetRef.current = currentOffset + res.length
      setOffset(offsetRef.current)
    } catch(e:any) {
      if (e.name==='AbortError') return
      setError(e.message??'Search failed')
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])  // stable — uses offsetRef, not offset state

  useEffect(()=>{
    if (!query||query.length<2) { setResults([]); setSearched(false); setHasMore(false); offsetRef.current=0; setOffset(0); return }
    const t = window.setTimeout(()=>{ offsetRef.current=0; doSearch(query,false) },200)
    return ()=>window.clearTimeout(t)
  },[query,doSearch])

  const clearSearch = ()=>{ setQuery(''); setResults([]); setSearched(false); setSelected(null); inputRef.current?.focus() }
  const loadMore    = ()=>{ if (!hasMore||loading) return; doSearch(query,true) }

  const grouped:any[] = Object.values(
    results.reduce((acc:any,r:any)=>{
      const key=`${r.person?.id??'np'}-${r.flat?.id??'nf'}`
      if (!acc[key]) acc[key]={...r}
      if (r.vehicles?.length) acc[key].vehicles=[...(acc[key].vehicles??[]),...r.vehicles]
      return acc
    },{})
  )

  const handleResultClick = async (entry:any)=>{
    // ── Step 1: open modal IMMEDIATELY with what we already have ─────────────
    // The search result already contains person, flat, vehicles from the index.
    // Show them right away so the user sees something in <1 frame.
    const instant = normalise(entry)
    setSelected(instant)

    // ── Step 2: enrich in the background (non-blocking) ──────────────────────
    const personId = entry?.person?.id ?? entry?.ownerships?.[0]?.person?.id ?? entry?.tenancies?.[0]?.person?.id
    if (!personId) return  // nothing more to fetch
    setEnriching(true)

    try {
      // Use cache to avoid redundant network calls on re-click
      const getCachedResident = async (id:string) => {
        if (residentCache.current.has(id)) return residentCache.current.get(id)
        const r = await api.getResident(id)
        residentCache.current.set(id, r)
        return r
      }
      const getCachedFlat = async (id:string) => {
        if (flatCache.current.has(id)) return flatCache.current.get(id)
        const f = await api.getFlat(id)
        flatCache.current.set(id, f)
        return f
      }

      // Fire resident + flat fetches in PARALLEL (not sequential)
      const flatId = entry.flat?.id
      const [resident, flatFull] = await Promise.all([
        getCachedResident(personId),
        flatId ? getCachedFlat(flatId).catch(()=>entry.flat) : Promise.resolve(entry.flat),
      ])

      let roleForFlat = entry.role
      if (resident.ownerships?.some((o:any)=>o.flatId===flatId))     roleForFlat='Owner'
      else if (resident.tenancies?.some((t:any)=>t.flatId===flatId)) roleForFlat='Tenant'

      let ownershipsSource = flatFull?.ownerships ?? resident.ownerships ?? []
      const primaryOwner   = ownershipsSource.find((o:any)=>o.isPrimary) ?? ownershipsSource[0]
      const ownerPid       = primaryOwner?.person?.id ?? primaryOwner?.personId

      // Fetch owner separately only if different from the clicked person
      const ownerResident = (ownerPid && ownerPid !== personId)
        ? await getCachedResident(ownerPid).catch(()=>null)
        : null

      if (ownerResident) {
        ownershipsSource = [
          { ...primaryOwner, person: ownerResident },
          ...ownershipsSource.filter((o:any)=>o !== primaryOwner),
        ]
      }

      // Update the already-open modal with the enriched data
      setSelected(normalise({
        person:     resident,
        flat:       flatFull,
        role:       roleForFlat,
        ownerships: ownershipsSource,
        tenancies:  flatFull?.tenancies ?? resident.tenancies,
        vehicles:   [...(ownerResident?.vehicles??[]),...(resident.vehicles??[]),...(entry.vehicles??[])],
      }))
    } catch {
      // Modal is already open with instant data — just leave it
    } finally {
      setEnriching(false)
    }
  }

  const AVATAR_PALETTE = [
    { bg:T.tealBg,  color:T.tealText,  border:T.brandMid },
    { bg:T.blueBg,  color:T.blueText,  border:'#93C5FD'  },
    { bg:T.amberBg, color:T.amberText, border:'#FCD34D'  },
  ]

  const parsed = query.length >= 3 ? parseBlockFlat(query) : null

  return (
    <>
      {/* Page header */}
      <div style={{ marginBottom:0 }} className="fade-up">
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:2 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' as const, color:T.brand, background:T.brandLight, border:`1px solid ${T.brandMid}`, borderRadius:20, padding:'3px 10px', display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', display:'inline-block' }} />
            MIG Society · Flat Search
          </div>
        </div>
        <h1 style={{ fontSize:30, fontWeight:800, color:T.text, letterSpacing:'-.02em', lineHeight:1.15, marginBottom:6 }}>
          Find any flat, <span style={{ color:T.purple }}>instantly.</span>
        </h1>
        <p style={{ fontSize:14, color:T.muted, marginBottom:0 }}>Search by flat number, owner, tenant name or mobile number</p>
      </div>

      {/* Search box */}
      <div className="card fade-up fade-up-1" style={{ padding:'20px 22px', margin:'20px 0 0' }}>
        <div style={{ position:'relative' }}>
          {loading
            ? <i className="ti ti-loader-2" aria-hidden style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:18, color:T.brand, animation:'spin 1s linear infinite', pointerEvents:'none' }} />
            : <i className="ti ti-search"   aria-hidden style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:18, color:T.hint, pointerEvents:'none' }} />
          }
          <input
            ref={inputRef}
            style={{ width:'100%', padding:'13px 52px 13px 44px', border:`2px solid var(--border)`, borderRadius:14, fontSize:15, color:T.text, background:'var(--gray-50)', outline:'none', fontFamily:'inherit', transition:'border-color .15s, background .15s, box-shadow .15s', boxSizing:'border-box' as const }}
            placeholder="Search by flat number, owner, tenant name or mobile number"
            value={query}
            onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Escape') clearSearch() }}
            onFocus={e=>{ e.currentTarget.style.borderColor=T.purple; e.currentTarget.style.background=T.surface; e.currentTarget.style.boxShadow='0 0 0 3px rgba(124,58,237,0.10)' }}
            onBlur={e=>{  e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--gray-50)'; e.currentTarget.style.boxShadow='none' }}
            aria-label="Search residents"
          />
          {query && (
            <button
              onClick={clearSearch}
              style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'var(--gray-200)', border:'none', cursor:'pointer', width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:T.muted, fontSize:12, padding:0 }}
              aria-label="Clear search"
            >✕</button>
          )}
        </div>

        {/* Hint chips */}
        <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' as const }}>
          {[
            { label:'B-101', icon:'ti-building' },
            { label:'Owner name', icon:'ti-user' },
            { label:'Mobile no.', icon:'ti-phone' },
            { label:'Tenant name', icon:'ti-users' },
          ].map(h=>(
            <button key={h.label} onClick={()=>{ setQuery(h.label); inputRef.current?.focus() }} style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:500, border:`1px solid var(--border)`, color:T.muted, background:'var(--gray-50)', cursor:'pointer' }}>
              TRY <span style={{ color:T.brand, fontWeight:600 }}>{h.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {stats && (
        <div style={{ display:'flex', gap:24, padding:'14px 0', borderBottom:`1px solid var(--border)`, marginBottom:8 }}>
          <div style={{ fontSize:13, color:T.muted }}><span style={{ fontWeight:700, fontSize:16, color:T.text }}>{stats.totalFlats}</span>  Total Flats</div>
          <div style={{ fontSize:13, color:T.muted }}><span style={{ fontWeight:700, fontSize:16, color:T.text }}>{stats.occupied}</span>  Occupied</div>
          <div style={{ fontSize:13, color:T.muted }}><span style={{ fontWeight:700, fontSize:16, color:T.text }}>{stats.paymentRecords}</span>  Payment Records</div>
        </div>
      )}

      {/* Block-flat parse hint */}
      {parsed && (
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:T.brand, background:T.brandLight, border:`1px solid ${T.brandMid}`, borderRadius:10, padding:'8px 14px', marginBottom:12 }}>
          <i className="ti ti-info-circle" aria-hidden style={{ fontSize:14 }} />
          Searching for <strong>Block-{parsed.block}</strong>, Flat <strong>{parsed.flat}</strong>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:10, background:T.redBg, border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', marginBottom:16, color:T.redText, fontSize:13 }}>
          <i className="ti ti-alert-circle" aria-hidden style={{ fontSize:16, flexShrink:0 }} />{error}
        </div>
      )}

      {/* ── Loading skeleton — shown while fetching, in place of results ─────── */}
      {loading && (
        <div className="card fade-up" style={{ overflow:'hidden', padding:0, marginTop:0 }}>
          {/* Header row matching the results panel */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'var(--gray-50)', borderBottom:`1px solid var(--border)` }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {/* Shimmer pill for "MATCHING FLATS" label */}
              <div style={{ width:110, height:14, borderRadius:20, background:'var(--gray-200)', animation:'shimmer 1.4s ease infinite' }} />
              {/* Shimmer count badge */}
              <div style={{ width:22, height:14, borderRadius:20, background:'var(--gray-200)', animation:'shimmer 1.4s ease infinite' }} />
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, color:T.brand, fontSize:12, fontWeight:600 }}>
              <i className="ti ti-loader-2" aria-hidden style={{ fontSize:14, animation:'spin 1s linear infinite' }} />
              Searching…
            </div>
          </div>

          {/* 5 skeleton rows that look exactly like real result rows */}
          {[1,2,3,4,5].map((n,i)=>(
            <div key={n} style={{
              display:'flex', alignItems:'center', gap:14, padding:'13px 16px',
              borderBottom: i < 4 ? `1px solid var(--border)` : 'none',
              animation:`shimmer 1.4s ease ${i*0.08}s infinite`
            }}>
              {/* Flat badge placeholder */}
              <div style={{ width:40, height:40, borderRadius:12, background:'var(--gray-100)', flexShrink:0 }} />

              <div style={{ flex:1, display:'flex', flexDirection:'column' as const, gap:7 }}>
                {/* Flat label line — varies width for realism */}
                <div style={{ height:13, borderRadius:20, background:'var(--gray-100)', width:`${[52,44,60,38,48][i]}%` }} />
                {/* Sub-info line */}
                <div style={{ height:10, borderRadius:20, background:'var(--gray-100)', width:`${[34,28,40,24,32][i]}%` }} />
              </div>

              {/* Status badge placeholder */}
              <div style={{ width:88, height:22, borderRadius:20, background:'var(--gray-100)', flexShrink:0 }} />
              {/* Chevron placeholder */}
              <div style={{ width:14, height:14, borderRadius:4, background:'var(--gray-100)', flexShrink:0 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Matching results ──────────────────────────────────────────────────── */}
      {!loading && searched && grouped.length > 0 && (
        <div className="card fade-up" style={{ overflow:'hidden', padding:0, marginTop:0 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', background:'var(--gray-50)', borderBottom:`1px solid var(--border)` }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase' as const, color:T.muted, display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-building" aria-hidden style={{ fontSize:13, color:T.brand }} />
              Matching Flats
              <span style={{ background:T.purple, color:'white', borderRadius:20, padding:'1px 7px', fontSize:10, fontWeight:700 }}>{grouped.length}</span>
            </div>
          </div>

          {grouped.map((r:any,i:number)=>{
            const roleStyle = r.role ? (ROLE_BADGE[r.role]??ROLE_BADGE.Owner) : null
            const flatBlock = r.flat?.block?.name ?? r.flat?.block ?? ''
            const flatNum   = r.flat?.flatNumber ?? ''
            const flatCode  = flatBlock && flatNum ? `${flatBlock.replace('Block-','B')}${flatBlock?'-':''}${flatNum}` : ''
            const flatLabel = flatBlock && flatNum ? `${flatBlock} · Flat ${flatNum}` : ''
            const statusKey = r.flat?.status ?? ''
            const statusMeta = STATUS_BADGE[statusKey]
            const plate     = (r.vehicle??r.vehicles?.[0])?.plateNumber
            const ac        = AVATAR_PALETTE[i%AVATAR_PALETTE.length]

            return (
              <div
                key={i}
                role="button" tabIndex={0}
                onClick={()=>handleResultClick(r)}
                onKeyDown={e=>(e.key==='Enter'||e.key===' ')&&handleResultClick(r)}
                style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', borderBottom:i<grouped.length-1?`1px solid var(--border)`:'none', cursor:'pointer', transition:'background .12s' }}
                onMouseEnter={e=>(e.currentTarget.style.background=T.brandLight)}
                onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
              >
                {/* Flat badge */}
                <div style={{ width:40, height:40, borderRadius:12, background:T.blueBg, border:`1.5px solid #93C5FD`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ fontSize:10, fontWeight:800, color:T.blueText, letterSpacing:'.02em', textTransform:'uppercase' as const }}>{flatCode || <i className="ti ti-building" />}</span>
                </div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:3 }}>{flatLabel || r.person?.name || 'Unknown'}</div>
                  <div style={{ fontSize:11, color:T.muted, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' as const }}>
                    {r.person?.name && <span><i className="ti ti-user" aria-hidden style={{ fontSize:10, marginRight:3 }} />{r.person.name}</span>}
                    {r.person?.phone && <span>· {r.person.phone}</span>}
                    {plate && <span>· <i className="ti ti-car" aria-hidden style={{ fontSize:10, marginRight:2 }} />{plate}</span>}
                  </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                  {statusMeta && <Badge label={statusMeta.label} bg={statusMeta.bg} color={statusMeta.color} />}
                  {roleStyle  && <Badge label={r.role} bg={roleStyle.bg} color={roleStyle.color} dot={roleStyle.dot} />}
                  <i className="ti ti-chevron-right" aria-hidden style={{ fontSize:14, color:T.hint }} />
                </div>
              </div>
            )
          })}

          {hasMore && (
            <div style={{ padding:'12px 16px', textAlign:'center' as const, borderTop:`1px solid var(--border)` }}>
              <button onClick={loadMore} className="btn-ghost" disabled={loading}>{loading?'Loading…':'Load more results'}</button>
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {searched && grouped.length===0 && !loading && (
        <div className="card" style={{ padding:'48px 20px', textAlign:'center' as const }}>
          <i className="ti ti-search-off" aria-hidden style={{ fontSize:36, color:'var(--gray-200)', marginBottom:12, display:'block' }} />
          <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:4 }}>No results for "{query}"</div>
          <div style={{ fontSize:13, color:T.muted }}>Try a different name, phone number, flat or vehicle number</div>
        </div>
      )}

      {/* Pre-search hint cards */}
      {!searched && !loading && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginTop:20 }} className="fade-up fade-up-2">
          {[
            { icon:'ti-building', label:'By flat',    ex:'1-103, B-302'   },
            { icon:'ti-user',     label:'By name',    ex:'Rahul Sharma'   },
            { icon:'ti-phone',    label:'By phone',   ex:'9876543210'     },
            { icon:'ti-car',      label:'By vehicle', ex:'CG04AB1234'     },
          ].map(h=>(
            <div key={h.label} className="card" style={{ padding:16, textAlign:'center' as const }}>
              <i className={`ti ${h.icon}`} aria-hidden style={{ fontSize:22, color:T.purple, marginBottom:8, display:'block' }} />
              <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:3 }}>{h.label}</div>
              <div style={{ fontSize:11, color:T.hint }}>{h.ex}</div>
            </div>
          ))}
        </div>
      )}

      {selected && <DetailPanel entry={selected} enriching={enriching} onClose={()=>{ setSelected(null); setEnriching(false) }} onPaymentRecorded={()=>{}} />}

      <style>{`
        @keyframes spin    { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes fade-in { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fade-in .22s ease both }
        .fade-up-1 { animation-delay:.06s }
        .fade-up-2 { animation-delay:.12s }
      `}</style>
    </>
  )
}