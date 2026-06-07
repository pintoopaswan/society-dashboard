# Search API and Testing

This document describes the new server-side search endpoint and how to test it locally.

Endpoint
- `GET /api/search-flats?q=...&limit=10&offset=0`

Behavior
- Attempts a Supabase query returning compact flat records with related owner/tenant minimal fields.
- If Supabase fails, falls back to the existing external API at `NEXT_PUBLIC_API_URL`.
- Payment history is intentionally not returned to keep payloads small.

Recommended DB indexes (Postgres)
- CREATE INDEX idx_flats_flat_number ON flats (flat_number);
- CREATE INDEX idx_blocks_name ON blocks (name);
- CREATE INDEX idx_person_name_lower ON persons ((lower(name)));
- CREATE INDEX idx_person_phone ON persons (phone);

Testing locally
1. Ensure environment variables are set (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. Start dev server:
```bash
npm run dev
```
3. Hit the endpoint in browser or curl:
```bash
curl "http://localhost:3000/api/search-flats?q=101&limit=5"
```

If results are empty, verify your Supabase schema relationship names. The select clause in `app/api/search-flats/route.ts` may need to be adjusted to match your exact table/foreign-key names.
