'use client'
// app/(admin)/residents/page.tsx
import { useEffect, useState } from 'react'
import { api, Person } from '@/lib/api'
import Link from 'next/link'
import { Users, Search, Plus, Phone, Home, RefreshCw, X } from 'lucide-react'

export default function ResidentsPage() {
  const [residents, setResidents] = useState<Person[]>([])
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState({ name: '', phone: '', email: '', altPhone: '', aadhaarLast4: '', panNumber: '', role: 'owner' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  const load = async (q = '') => {
    setLoading(true)
    try {
      const res = await api.getResidents(q)
      let list: any[] = []
      if (Array.isArray(res)) list = res
      else if (res && Array.isArray((res as any).data)) list = (res as any).data
      else if (res && Array.isArray((res as any).residents)) list = (res as any).residents
      else list = []
      setResidents(list)
      return list
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSearch = (v: string) => {
    setSearch(v)
    if (v.length >= 2 || v.length === 0) {
      load(v).then(list => {
        if (Array.isArray(list) && v.length >= 2 && list.length === 1)
          window.location.href = `/residents/${list[0].id}`
      })
    }
  }

  const handleAdd = async () => {
    if (!form.name || !form.phone) { setError('Name and phone are required'); return }
    setSaving(true); setError('')
    try {
      await api.addResident(form)
      setShowAdd(false)
      setForm({ name: '', phone: '', email: '', altPhone: '', aadhaarLast4: '', panNumber: '', role: 'owner' })
      load()
    } catch (e: any) {
      const detailMsg = e.details ? Object.entries(e.details).flatMap(([k, v]: any) => `${k}: ${(v as string[]).join(', ')}`).join(' · ') : ''
      setError(e.message + (detailMsg ? ` — ${detailMsg}` : ''))
    } finally { setSaving(false) }
  }

  const filtered = (Array.isArray(residents) ? residents : []).filter(r => {
    const q = search.trim(); if (!q) return true
    const ql = q.toLowerCase()
    if ((r.name ?? '').toLowerCase().includes(ql)) return true
    if ((r.phone ?? '').includes(q)) return true
    if (r.ownerships?.some((o: any) => (o?.flat?.flatNumber ?? '').includes(q))) return true
    if (r.tenancies?.some((t: any) => (t?.flat?.flatNumber ?? '').includes(q))) return true
    return false
  })

  const getFlats = (r: any) => ({
    owned:  (r.ownerships ?? []).map((o: any) => `${o?.flat?.block?.name ?? o?.flat?.block ?? ''}‑${o?.flat?.flatNumber ?? ''}`),
    rented: (r.tenancies  ?? []).map((t: any) => `${t?.flat?.block?.name ?? t?.flat?.block ?? ''}‑${t?.flat?.flatNumber ?? ''}`),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={20} color="#64748b" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>Residents</h1>
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '2px 0 0' }}>{residents.length} persons registered</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <Plus size={15} /> Add Resident
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ position: 'relative', width: '100%', boxSizing: 'border-box' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none', zIndex: 1 }}>
          <Search size={16} color="#94a3b8" />
        </span>
        <input
          className="input"
          style={{
            display: 'block', width: '100%', boxSizing: 'border-box',
            paddingLeft: 42, paddingRight: search ? 40 : 14,
            height: 44, fontSize: 14,
            border: '1.5px solid #e2e8f0',
            borderRadius: 10,
            background: '#fff',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          placeholder="Search by name, phone, or flat number…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
          onBlur={e => (e.currentTarget.style.borderColor = '#e2e8f0')}
        />
        {search && (
          <button
            onClick={() => handleSearch('')}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              width: 22, height: 22, borderRadius: 6, border: 'none',
              background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', padding: 0, color: '#64748b',
              transition: 'background 0.12s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#cbd5e1')}
            onMouseLeave={e => (e.currentTarget.style.background = '#e2e8f0')}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, color: '#94a3b8', gap: 8 }}>
          <RefreshCw size={18} className="animate-spin" /> Loading residents…
        </div>
      ) : (
        /* Intentionally NOT using className="card" — the card class has a baked-in max-width */
        <div style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--surface-card, #ffffff)',
          border: '1px solid var(--surface-border, #e2e8f0)',
          borderRadius: 14,
          overflow: 'hidden',
          // Force full width even if a parent sets max-width
          alignSelf: 'stretch',
        }}>
          {/* Column header bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>
              {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"` : `${filtered.length} resident${filtered.length !== 1 ? 's' : ''}`}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8' }}>Flat / Unit</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 16px' }}>
              <Users size={32} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3, color: '#94a3b8' }} />
              <p style={{ margin: 0, fontSize: 14, color: '#94a3b8' }}>No residents found</p>
              {search && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#cbd5e1' }}>Try a different search term</p>}
            </div>
          ) : filtered.map((r: any, idx) => {
            const { owned, rented } = getFlats(r)
            const hasFlats = owned.length > 0 || rented.length > 0
            return (
              <Link
                key={r.id}
                href={`/residents/${r.id}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '13px 20px', gap: 16, textDecoration: 'none',
                  borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid #f8fafc',
                  width: '100%', boxSizing: 'border-box',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#fafbfc')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                {/* Left: avatar + name + phone */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: '#7c3aed', flexShrink: 0 }}>
                    {(r.name ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name ?? 'Unknown'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <Phone size={11} color="#94a3b8" />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{r.phone ?? '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: flat badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {!hasFlats && <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>}
                  {owned.map((flat: string) => (
                    <span key={flat} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#7c3aed', background: 'rgba(124,58,237,0.08)', padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                      <Home size={10} /> {flat}
                    </span>
                  ))}
                  {rented.map((flat: string) => (
                    <span key={flat} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#2563eb', background: 'rgba(37,99,235,0.08)', padding: '3px 8px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                      <Home size={10} /> {flat}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Add resident modal ── */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }} onClick={() => setShowAdd(false)} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 460, borderRadius: 16, padding: 28, background: 'var(--surface-card, #fff)', boxShadow: '0 24px 64px rgba(15,23,42,0.18)', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '90vh', overflowY: 'auto' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: 0 }}>Add Resident</h2>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0' }}>Register a new resident profile</p>
              </div>
              <button onClick={() => setShowAdd(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}>
                <X size={15} />
              </button>
            </div>

            {error && <div style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px' }}>{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Full Name',       key: 'name',         placeholder: 'e.g. Rajesh Kumar', req: true,  type: 'text'  },
                { label: 'Phone Number',    key: 'phone',        placeholder: '10-digit mobile',   req: true,  type: 'tel'   },
                { label: 'Alternate Phone', key: 'altPhone',     placeholder: 'Optional',           req: false, type: 'tel'   },
                { label: 'Email',           key: 'email',        placeholder: 'Optional',           req: false, type: 'email' },
                { label: 'Aadhaar Last 4',  key: 'aadhaarLast4', placeholder: 'e.g. 4521',         req: false, type: 'text', max: 4  },
                { label: 'PAN Number',      key: 'panNumber',    placeholder: 'e.g. ABCDE1234F',   req: false, type: 'text', max: 10 },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 5 }}>
                    {f.label} {f.req && <span style={{ color: '#f87171' }}>*</span>}
                  </label>
                  <input className="input" style={{ display: 'block', width: '100%', boxSizing: 'border-box' }}
                    placeholder={f.placeholder} type={f.type} maxLength={f.max}
                    value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                </div>
              ))}

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>Role</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {['owner', 'tenant'].map(role => (
                    <button key={role} onClick={() => setForm({ ...form, role })}
                      style={{ flex: 1, padding: 9, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500, border: form.role === role ? '1.5px solid #7c3aed' : '1.5px solid #e2e8f0', background: form.role === role ? 'rgba(124,58,237,0.06)' : 'white', color: form.role === role ? '#7c3aed' : '#64748b', transition: 'all 0.15s' }}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAdd(false)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
                {saving ? 'Saving…' : 'Save Resident'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}