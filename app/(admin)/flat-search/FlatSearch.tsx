"use client"
import React, { useEffect, useRef, useState } from 'react'
import { searchAll } from '@/lib/api'
import { useRouter } from 'next/navigation'

function highlight(text: string, q: string) {
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text
  return (
    <>{text.slice(0, idx)}<mark className="bg-amber-200/60 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>
  )
}

export default function FlatSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      if ((isMac && e.metaKey && e.key.toLowerCase() === 'k') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault(); setOpen(true); setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      if (!q || q.length < 1) { setResults([]); setLoading(false); return }
      setLoading(true)
      searchAll(q, { limit: 10 }).then(r => setResults(r)).catch(() => setResults([])).finally(() => setLoading(false))
    }, 250)
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current) }
  }, [q, open])

  useEffect(() => setActive(0), [results])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const sel = results[active]
      if (!sel) return
      try { localStorage.setItem('globalSearchSelected', JSON.stringify(sel)) } catch (e) {}
      setOpen(false)
      router.push('/search')
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div aria-hidden={false} className="fixed inset-0 z-50 pointer-events-none">
      <div className={`absolute inset-0 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} />

      <div className="fixed left-1/2 transform -translate-x-1/2 top-20 w-[min(880px,92%)] pointer-events-auto">
        <div className="relative">
          <div className={`flex items-center gap-3 p-3 rounded-2xl bg-white shadow-lg transition-all ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95'} `}>
            <div className="flex-1">
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                onFocus={() => setOpen(true)}
                placeholder="Search flats, owner, tenant or mobile (Cmd/Ctrl+K)"
                className="w-full bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
                aria-label="Search flats"
              />
            </div>
            <div className="flex-shrink-0 text-sm text-slate-400">{loading ? 'Searching…' : `${results.length} results`}</div>
          </div>

          {open && (
            <div className="mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden max-h-96">
              <div className="divide-y">
                {results.length === 0 && !loading ? (
                  <div className="p-4 text-sm text-slate-500">No results</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {results.map((r, i) => {
                      const owner = r.person ?? r.ownerships?.[0]?.person
                      const tenant = r.flat?.tenancies?.[0]?.person ?? r.tenancies?.[0]?.person
                      const block = r.flat?.block?.name ?? r.flat?.block ?? r.flat?.blockName ?? r.flat?.block
                      const flatNo = r.flat?.flatNumber ?? r.flatNumber ?? r.flat?.flat
                      const status = r.flat?.status ?? r.status ?? (tenant ? 'Tenant' : owner ? 'Owner' : 'Vacant')
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            try { localStorage.setItem('globalSearchSelected', JSON.stringify(r)) } catch (e) {}
                            setOpen(false); router.push('/search')
                          }}
                          onMouseEnter={() => setActive(i)}
                          className={`w-full text-left p-3 flex items-start gap-3 hover:bg-gray-50 ${i === active ? 'bg-emerald-50' : ''}`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 font-semibold flex items-center justify-center text-sm flex-shrink-0">{block?.toString()?.slice(0,2) ?? 'B'}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-sm text-slate-900 truncate">{block} • <span className="text-emerald-600">Flat {flatNo}</span></div>
                              <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${status === 'VACANT' || status === 'Vacant' ? 'bg-slate-100 text-slate-600' : status === 'RENTED' || status === 'Tenant' ? 'bg-blue-50 text-blue-500' : 'bg-violet-50 text-violet-600'}`}>{status}</div>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              <div>Owner: <span className="text-slate-700">{owner?.name ?? 'Unknown'}</span></div>
                              <div>Tenant: <span className="text-slate-700">{tenant?.name ?? 'Vacant'}</span></div>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
