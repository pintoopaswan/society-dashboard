"use client"
import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  brand:        '#0D9488',   // teal-600 — sharper, more saturated
  brandDark:    '#0F766E',   // teal-700
  brandLight:   '#F0FDFA',   // teal-50
  brandBorder:  '#99F6E4',   // teal-200
  purple:       '#7C3AED',
  purpleLight:  '#F5F3FF',

  tealBg:    '#CCFBF1', tealText:    '#0F766E',
  blueBg:    '#DBEAFE', blueText:    '#1D4ED8',
  amberBg:   '#FEF3C7', amberText:   '#92400E',
  redBg:     '#FEE2E2', redText:     '#B91C1C',
  grayBg:    '#F3F4F6', grayText:    '#6B7280',
  greenBg:   '#DCFCE7', greenText:   '#15803D',
}

const STATUS_BADGE: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  OWNER_OCCUPIED: { bg: '#F0FDFA', color: '#0F766E', dot: '#14B8A6', label: 'Owner Occupied'  },
  RENTED:         { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6', label: 'Tenant Occupied' },
  TENANT:         { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6', label: 'Tenant'          },
  VACANT:         { bg: '#F9FAFB', color: '#4B5563', dot: '#9CA3AF', label: 'Vacant'          },
  LOCKED:         { bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444', label: 'Locked'          },
}

const PAY_BADGE: Record<string, { bg: string; color: string; dot: string }> = {
  PAID:    { bg: '#F0FDF4', color: '#15803D', dot: '#22C55E' },
  PENDING: { bg: '#FFFBEB', color: '#92400E', dot: '#F59E0B' },
  OVERDUE: { bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
  PARTIAL: { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function DetailRow({ label, value, href }: { label: string; value: React.ReactNode; href?: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0', borderBottom: '1px solid #F1F5F9'
    }}>
      <div style={{ fontSize: 12, color: '#64748B', fontWeight: 500, letterSpacing: '.01em' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', textAlign: 'right' as const, maxWidth: '60%' }}>
        {href
          ? <a href={href} style={{ color: T.brand, textDecoration: 'none', fontWeight: 600 }}>{value}</a>
          : value ?? <span style={{ color: '#CBD5E1' }}>—</span>}
      </div>
    </div>
  )
}

function SectionCard({
  accentColor, iconBg, iconColor, icon, title, subtitle, editLabel, onEdit, children
}: {
  accentColor: string; iconBg: string; iconColor: string; icon: string; title: string; subtitle?: string;
  editLabel?: string; onEdit?: () => void; children: React.ReactNode
}) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'
    }}>
      <div style={{
        borderTop: `2.5px solid ${accentColor}`,
        padding: '14px 18px 13px',
        borderBottom: '1px solid #F1F5F9',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(180deg, #FAFCFF 0%, white 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: iconBg,
            border: `1px solid ${accentColor}25`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <i className={`ti ${icon}`} aria-hidden style={{ fontSize: 15, color: iconColor }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{subtitle}</div>}
          </div>
        </div>
        {editLabel && onEdit && (
          <button
            onClick={onEdit}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'white', border: '1.5px solid #E2E8F0',
              color: '#475569', cursor: 'pointer',
              transition: 'all .15s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = T.brand
              ;(e.currentTarget as HTMLButtonElement).style.color = T.brand
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'
              ;(e.currentTarget as HTMLButtonElement).style.color = '#475569'
            }}
          >
            <i className="ti ti-edit" aria-hidden style={{ fontSize: 12 }} />{editLabel}
          </button>
        )}
      </div>
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  )
}

function StatBadge({ value, label, color, bg, borderColor }: { value: string|number; label: string; color: string; bg: string; borderColor: string }) {
  return (
    <div style={{
      flex: 1,
      background: bg,
      borderRadius: 14,
      padding: '16px 18px',
      border: `1px solid ${borderColor}`,
      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-.02em' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 5, fontWeight: 500, letterSpacing: '.02em', textTransform: 'uppercase' as const }}>{label}</div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

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

  // Inject Tabler Icons font if not already present
  useEffect(() => {
    const TABLER_CDN = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.30.0/dist/tabler-icons.min.css'
    if (!document.querySelector('link[data-tabler-icons]')) {
      const link = document.createElement('link')
      link.rel  = 'stylesheet'
      link.href = TABLER_CDN
      link.setAttribute('data-tabler-icons', 'true')
      document.head.appendChild(link)
    }
  }, [])

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

  const inputStyle: React.CSSProperties = {
    padding: '10px 13px', borderRadius: 10, border: '1.5px solid #E2E8F0',
    fontSize: 13, color: '#0F172A', background: '#FAFAFA',
    fontFamily: 'inherit', outline: 'none', width: '100%',
    transition: 'border-color .15s'
  }

  const selectStyle: React.CSSProperties = {
    padding: '7px 11px', borderRadius: 9,
    border: '1.5px solid #E2E8F0', fontSize: 12, fontWeight: 500,
    color: '#334155', background: 'white', fontFamily: 'inherit', cursor: 'pointer',
    outline: 'none', appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 9px center',
    paddingRight: 30,
    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
  }

  if (typeof document === 'undefined') return null

  const SIDEBAR = 240

  return createPortal(
    <>
      <div
        style={{ position: 'fixed', top: 0, left: SIDEBAR, right: 0, bottom: 0, zIndex: 9998, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      <div
        style={{
          position: 'fixed', top: 0, left: SIDEBAR, right: 0, bottom: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column', overflowY: 'auto',
          background: '#F8FAFC'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Sticky top bar ── */}
        <div style={{
          background: 'white',
          borderBottom: '1px solid #E2E8F0',
          padding: '13px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>Resident Profile</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 1, fontWeight: 400 }}>MIG Society, Sector-29 · Payment history &amp; details</div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 15px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: 'white', border: '1.5px solid #E2E8F0',
              color: '#475569', cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              transition: 'all .15s'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1'; (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFC' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.background = 'white' }}
          >
            <i className="ti ti-x" aria-hidden style={{ fontSize: 13 }} />Close
          </button>
        </div>

        {/* ── Flat identity hero ── */}
        <div style={{ padding: '22px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' as const }}>
            {/* Flat code pill */}
            <div style={{
              background: T.purple,
              color: 'white', fontWeight: 800, fontSize: 14,
              borderRadius: 12, padding: '10px 20px',
              letterSpacing: '.02em', display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: '0 4px 12px rgba(124,58,237,0.30)'
            }}>
              <i className="ti ti-home-2" aria-hidden style={{ fontSize: 14 }} />{flatCode || 'Flat'}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 21, fontWeight: 800, color: '#0F172A', letterSpacing: '-.02em' }}>{flatLabel}</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                {/* Status badge inline */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                  background: occMeta.bg, color: occMeta.color, border: `1px solid ${occMeta.dot}30`
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: occMeta.dot, display: 'inline-block' }} />
                  {occMeta.label}
                </span>
                {!payLoading && <span style={{ color: '#CBD5E1' }}>·</span>}
                {!payLoading && <span>{totalCount} records</span>}
                {owner  && <><span style={{ color: '#CBD5E1' }}>·</span><span>{owner.name}</span></>}
                {tenant && <><span style={{ color: '#CBD5E1' }}>·</span><span>Tenant: {tenant.name}</span></>}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div style={{ padding: '20px 28px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Flat Info */}
          <SectionCard accentColor={T.brand} iconBg="#F0FDFA" iconColor={T.brandDark} icon="ti-home-2" title="Flat Information" subtitle={`${flatNum} · ${flatBlock}`}>
            <DetailRow label="Block"    value={flatBlock || '—'} />
            <DetailRow label="Flat No." value={flatNum || '—'} />
            <DetailRow label="Floor"    value={flat?.floor ?? '—'} />
            <DetailRow label="Status"   value={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: occMeta.bg, color: occMeta.color }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: occMeta.dot, display: 'inline-block' }} />
                {occMeta.label}
              </span>
            } />
          </SectionCard>

          {/* Owner */}
          <SectionCard
            accentColor={T.brand} iconBg="#F0FDFA" iconColor={T.brandDark}
            icon="ti-user-circle" title="Owner Details" subtitle={owner?.name ?? 'No owner'}
            editLabel={owner ? 'Edit' : undefined}
            onEdit={() => router.push(owner?.id ? `/residents/${owner.id}` : '/residents')}
          >
            {owner ? (
              <>
                <DetailRow label="Name"          value={owner.name} />
                <DetailRow label="Mobile"        value={owner.phone}    href={owner.phone ? `tel:${owner.phone}` : undefined} />
                <DetailRow label="Alternate"     value={owner.altPhone ?? '—'} />
                <DetailRow label="Email"         value={owner.email ?? '—'} />
                <DetailRow label="City/Location" value={owner.address ?? '—'} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#CBD5E1', padding: '8px 0' }}>No owner information available</div>
            )}
          </SectionCard>

          {/* Tenant */}
          <SectionCard
            accentColor="#2563EB" iconBg="#EFF6FF" iconColor="#1D4ED8"
            icon="ti-users" title="Tenant Details"
            subtitle={tenant ? `Occupied by ${tenant.name}` : 'Vacant'}
            editLabel={tenant ? 'Edit' : undefined}
            onEdit={() => router.push(tenant?.id ? `/residents/${tenant.id}` : '/residents')}
          >
            {tenant ? (
              <>
                <DetailRow label="Name"         value={tenant.name} />
                <DetailRow label="Mobile"       value={tenant.phone}   href={tenant.phone ? `tel:${tenant.phone}` : undefined} />
                <DetailRow label="Email"        value={tenant.email ?? '—'} />
                <DetailRow label="Tenant Since" value={tenant.moveInDate ?? '—'} />
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#CBD5E1', padding: '8px 0' }}>Vacant — no tenant assigned</div>
            )}
          </SectionCard>

          {/* Vehicles */}
          <SectionCard
            accentColor="#D97706" iconBg="#FFFBEB" iconColor="#B45309"
            icon="ti-car" title="Vehicle Details"
            subtitle={(entry.vehicles ?? []).map((v:any) => v.plateNumber).join(' ') || 'No vehicles'}
          >
            {(entry.vehicles ?? []).length > 0 ? (
              <>
                <DetailRow label="Vehicle No."  value={(entry.vehicles ?? []).map((v:any) => v.plateNumber).join(', ')} />
                <DetailRow label="Vehicle Type" value={(entry.vehicles ?? []).map((v:any) => v.type).join(', ')} />
                <div style={{ marginTop: 12 }}>
                  <button
                    onClick={() => router.push('/vehicles')}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: 'white', border: '1.5px solid #E2E8F0',
                      color: '#475569', cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)', transition: 'all .15s'
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#D97706'; (e.currentTarget as HTMLButtonElement).style.color = '#D97706' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; (e.currentTarget as HTMLButtonElement).style.color = '#475569' }}
                  >
                    <i className="ti ti-edit" aria-hidden style={{ fontSize: 12 }} />Edit Vehicles
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#CBD5E1', padding: '8px 0' }}>No vehicles listed</div>
            )}
          </SectionCard>

          {/* ── Payment stats — full width ── */}
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12 }}>
            <StatBadge value={paidCount}    label="Months Paid"        color={T.greenText}  bg="#F0FDF4"  borderColor="#BBF7D0" />
            <StatBadge value={pendingCount} label="Outstanding"        color={T.redText}    bg="#FEF2F2"  borderColor="#FECACA" />
            <StatBadge value={partialCount} label="Partial"            color={T.blueText}   bg="#EFF6FF"  borderColor="#BFDBFE" />
            <StatBadge value={totalCount}   label="All Time Records"   color="#6D28D9"      bg="#F5F3FF"  borderColor="#DDD6FE" />
          </div>

          {/* Pending alert */}
          {pendingCount > 0 && (
            <div style={{
              gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10,
              background: '#FFFBEB', border: '1px solid #FDE68A',
              borderRadius: 12, padding: '12px 18px',
              color: '#92400E', fontWeight: 600, fontSize: 13
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: '#FEF3C7', border: '1px solid #FDE68A',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <i className="ti ti-alert-triangle" aria-hidden style={{ fontSize: 15, color: '#D97706' }} />
              </div>
              <span>
                <strong>{pendingCount} pending payment{pendingCount !== 1 ? 's' : ''}</strong> need to be collected
              </span>
            </div>
          )}

          {/* ── Payment History table — full width ── */}
          <div style={{
            gridColumn: '1 / -1', background: 'white',
            border: '1px solid #E2E8F0', borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)'
          }}>
            {/* Table header bar */}
            <div style={{
              borderTop: '2.5px solid #2563EB',
              padding: '15px 20px 13px',
              borderBottom: '1px solid #F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap' as const, gap: 10,
              background: 'linear-gradient(180deg, #FAFCFF 0%, white 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <i className="ti ti-credit-card" aria-hidden style={{ fontSize: 15, color: '#2563EB' }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>Payment History</div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select value={payYear} onChange={e => setPayYear(e.target.value)} style={selectStyle}>
                  <option>All Years</option>
                  {availableYears.map(y => <option key={y}>{y}</option>)}
                </select>
                <select value={payStatus} onChange={e => setPayStatus(e.target.value)} style={selectStyle}>
                  <option>All Statuses</option>
                  <option>PAID</option>
                  <option>PENDING</option>
                  <option>PARTIAL</option>
                </select>
                <span style={{
                  fontSize: 12, color: '#64748B', fontWeight: 600,
                  background: '#F8FAFC', border: '1.5px solid #E2E8F0',
                  borderRadius: 8, padding: '6px 11px'
                }}>
                  {filteredPayments.length} records
                </span>
              </div>
            </div>

            {payLoading ? (
              <div style={{ padding: '40px', textAlign: 'center' as const, color: '#94A3B8', fontSize: 13 }}>
                <i className="ti ti-loader-2" aria-hidden style={{ fontSize: 26, display: 'block', marginBottom: 8, color: T.brand, animation: 'spin 1s linear infinite' }} />
                Loading payment records…
              </div>
            ) : (
              <>
                {/* Column headers */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.5fr 1.5fr 1fr 96px',
                  background: '#F8FAFC', borderBottom: '1px solid #F1F5F9',
                  padding: '10px 20px', gap: 0
                }}>
                  {['Month / Year','Amount (₹)','Payment Date','Mode','Months Covered','Remarks','Status',''].map((h, i) => (
                    <div key={i} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', letterSpacing: '.08em', textTransform: 'uppercase' as const }}>{h}</div>
                  ))}
                </div>

                <div style={{ maxHeight: 380, overflowY: 'auto' as const }}>
                  {filteredPayments.length === 0 && (
                    <div style={{ padding: '36px 20px', textAlign: 'center' as const, fontSize: 13, color: '#CBD5E1' }}>
                      No payment records match your filters
                    </div>
                  )}
                  {filteredPayments.map((p, i) => {
                    const ps = PAY_BADGE[p.status] ?? PAY_BADGE.PENDING
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1.5fr 1.5fr 1fr 96px',
                          alignItems: 'center', padding: '13px 20px',
                          borderBottom: i < filteredPayments.length - 1 ? '1px solid #F1F5F9' : 'none',
                          background: 'white', transition: 'background .1s', gap: 0
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FAFCFF')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>{p.billingMonth}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: p.totalAmount ? '#0F172A' : '#CBD5E1' }}>
                          {p.totalAmount ? `₹${Number(p.totalAmount).toLocaleString('en-IN')}` : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'numeric', year: 'numeric' }) : '—'}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{p.mode ?? '—'}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>{p.monthsCovered ?? '—'}</div>
                        <div style={{ fontSize: 12, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, maxWidth: 160 }}>{p.remarks ?? '—'}</div>
                        <div>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: ps.bg, color: ps.color, border: `1px solid ${ps.dot}30`
                          }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ps.dot, display: 'inline-block' }} />
                            {p.status === 'PAID' ? 'Paid' : p.status === 'PARTIAL' ? 'Partial' : 'Pending'}
                          </span>
                        </div>

                        {/* ── Edit & Delete — visually distinctive ── */}
                        <div style={{ display: 'flex', gap: 5 }}>
                          {/* Edit: teal-tinted, icon only */}
                          <button
                            onClick={() => setRecording(p)}
                            title="Edit payment"
                            style={{
                              width: 30, height: 30, borderRadius: 8,
                              border: '1.5px solid #99F6E4',
                              background: '#F0FDFA',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: T.brandDark,
                              transition: 'all .15s',
                              flexShrink: 0
                            }}
                            onMouseEnter={e => {
                              const b = e.currentTarget as HTMLButtonElement
                              b.style.background = T.brand; b.style.color = 'white'; b.style.borderColor = T.brand
                            }}
                            onMouseLeave={e => {
                              const b = e.currentTarget as HTMLButtonElement
                              b.style.background = '#F0FDFA'; b.style.color = T.brandDark; b.style.borderColor = '#99F6E4'
                            }}
                          >
                            <i className="ti ti-edit" aria-hidden style={{ fontSize: 13 }} />
                          </button>

                          {/* Delete: red, clearly destructive */}
                          <button
                            title="Delete payment"
                            style={{
                              width: 30, height: 30, borderRadius: 8,
                              border: '1.5px solid #FECACA',
                              background: '#FEF2F2',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: '#DC2626',
                              transition: 'all .15s',
                              flexShrink: 0
                            }}
                            onMouseEnter={e => {
                              const b = e.currentTarget as HTMLButtonElement
                              b.style.background = '#DC2626'; b.style.color = 'white'; b.style.borderColor = '#DC2626'
                            }}
                            onMouseLeave={e => {
                              const b = e.currentTarget as HTMLButtonElement
                              b.style.background = '#FEF2F2'; b.style.color = '#DC2626'; b.style.borderColor = '#FECACA'
                            }}
                          >
                            <i className="ti ti-trash" aria-hidden style={{ fontSize: 13 }} />
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

      {/* ── Record Payment modal ── */}
      {recording && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,0.50)', backdropFilter: 'blur(3px)' }}
          onClick={() => setRecording(null)}
        >
          <div
            style={{
              position: 'relative', width: '100%', maxWidth: 390,
              background: 'white', borderRadius: 20, overflow: 'hidden',
              boxShadow: '0 24px 64px -12px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.06)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal top accent */}
            <div style={{ height: 3, background: `linear-gradient(90deg, ${T.brand}, #2563EB)` }} />

            <div style={{ padding: '20px 22px 22px' }}>
              {/* Modal header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-.01em' }}>Record Payment</div>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>Confirm and save the transaction</div>
                </div>
                <button
                  onClick={() => setRecording(null)}
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E2E8F0',
                    background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#64748B'
                  }}
                >
                  <i className="ti ti-x" style={{ fontSize: 14 }} />
                </button>
              </div>

              {/* Flat summary card */}
              <div style={{
                background: T.brandLight, border: `1.5px solid ${T.brandBorder}`,
                borderRadius: 13, padding: '13px 16px', marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, color: T.brandDark, fontWeight: 600 }}>{flatBlock} · Flat {flatNum}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{recording.billingMonth}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.brandDark, letterSpacing: '-.02em' }}>
                    ₹{Number(recording.totalAmount).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Payment mode */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 9 }}>Payment Mode</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7 }}>
                  {['CASH','UPI','ONLINE'].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      style={{
                        padding: '9px 0', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: mode === m ? T.brand : 'white',
                        color: mode === m ? '#fff' : '#475569',
                        border: mode === m ? `1.5px solid ${T.brand}` : '1.5px solid #E2E8F0',
                        boxShadow: mode === m ? `0 4px 12px ${T.brand}40` : '0 1px 2px rgba(0,0,0,0.04)',
                        transition: 'all .15s'
                      }}
                    >{m}</button>
                  ))}
                </div>
              </div>

              {/* Late fee */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: '.07em', marginBottom: 9 }}>Late Fee (₹)</div>
                <input type="number" style={inputStyle} placeholder="0" value={lateFee} onChange={e => setLateFee(Number(e.target.value))} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 9 }}>
                <button
                  onClick={() => setRecording(null)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 11,
                    background: '#F8FAFC', color: '#475569',
                    border: '1.5px solid #E2E8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >Cancel</button>
                <button
                  onClick={handleRecord}
                  disabled={saving}
                  style={{
                    flex: 2, padding: '10px 0', borderRadius: 11,
                    background: saving ? '#A7F3D0' : T.brand,
                    color: '#fff', border: 'none', fontSize: 13, fontWeight: 700,
                    cursor: saving ? 'not-allowed' : 'pointer',
                    boxShadow: saving ? 'none' : `0 4px 14px ${T.brand}50`,
                    transition: 'all .2s', letterSpacing: '-.01em'
                  }}
                >
                  {saving ? 'Saving…' : `Confirm · ₹${(Number(recording.totalAmount) + lateFee).toLocaleString('en-IN')}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
      `}</style>
    </>,
    document.body
  )
}