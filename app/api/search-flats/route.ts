import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Server-side search endpoint for Flats (compact results)
// Supports query params: q, limit, offset
// NOTE: Adjust table/column names if your Supabase schema differs.
// Recommended DB indexes (run in your Postgres DB):
// CREATE INDEX idx_flats_flat_number ON flats (flat_number);
// CREATE INDEX idx_person_name_lower ON persons (lower(name));
// CREATE INDEX idx_person_phone ON persons (phone);
// CREATE INDEX idx_blocks_name ON blocks (name);

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()
  const limit = Number(url.searchParams.get('limit') || '10')
  const offset = Number(url.searchParams.get('offset') || '0')

  if (!q || q.length < 1) {
    return NextResponse.json({ success: true, data: [] })
  }

  try {
    // Try Supabase first. This query uses PostgREST's ability to select related rows.
    // If your relationship names differ, adjust the select clause accordingly.
    const pattern = `%${q}%`
    const { data, error } = await supabase
      .from('flats')
      .select(
        `id, flat_number, flat_number as flatNumber, floor, status, block:blocks(name), block_id, \
         ownerships:ownerships(person(name,phone)), tenancies:tenancies(person(name,phone))`,
        { count: 'estimated' }
      )
      .or(`flat_number.ilike.${pattern},block_id.ilike.${pattern},block_id.eq.${q}`)
      .limit(limit)
      .offset(offset)

    if (error) {
      console.warn('Supabase search error, falling back to external API', error.message)
      throw error
    }

    // Map to compact shape expected by frontend
    const mapped = (data as any[] | null)?.map(d => ({
      id: d.id,
      flatNumber: d.flatNumber ?? d.flat_number,
      floor: d.floor,
      status: d.status,
      block: { name: d.block?.name ?? d.block_id },
      ownerships: (d.ownerships ?? []).map((o: any) => ({ person: o.person })),
      tenancies: (d.tenancies ?? []).map((t: any) => ({ person: t.person })),
    })) ?? []

    return NextResponse.json({ success: true, data: mapped })
  } catch (e) {
    // Fallback: proxy to the existing external API search if available
    const BASE = process.env.NEXT_PUBLIC_API_URL
    if (BASE) {
      try {
        const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`)
        const json = await res.json()
        return NextResponse.json(json)
      } catch (err) {
        console.error('Fallback search failed', err)
        return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 })
  }
}
