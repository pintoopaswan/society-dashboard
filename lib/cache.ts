// lib/cache.ts
// Redis caching layer – Week 13-15 Analytics Optimisation
// Keys: collection-rate · defaulter-count · fund-balance
// Default TTL: 15 minutes (matches materialized view refresh cadence)

import { createClient } from 'redis'

// ── Singleton client ─────────────────────────────────────────
let client: ReturnType<typeof createClient> | null = null

async function getClient() {
  if (!client) {
    client = createClient({ url: process.env.REDIS_URL ?? 'redis://localhost:6379' })
    client.on('error', (err) => console.error('[Redis]', err))
    await client.connect()
  }
  return client
}

// ── TTLs (seconds) ────────────────────────────────────────────
export const TTL = {
  COLLECTION_RATE:  60 * 15,   // 15 min  – matches MV refresh
  DEFAULTER_COUNT:  60 * 15,   // 15 min
  FUND_BALANCE:     60 * 15,   // 15 min
  COLLECTION_REPORT:60 * 30,   // 30 min  – heavier query
  DEFAULTERS_REPORT:60 * 15,   // 15 min
} as const

// ── Cache keys ────────────────────────────────────────────────
export const KEYS = {
  collectionRate:   'dashboard:collection-rate',
  defaulterCount:   'dashboard:defaulter-count',
  fundBalance:      'dashboard:fund-balance',
  collectionReport: (year: number, month: number) =>
    `report:collection:${year}-${String(month).padStart(2, '0')}`,
  defaultersReport: (bucket: string) =>
    `report:defaulters:${bucket}`,
  incomeExpenseTrend: 'dashboard:income-expense-trend',
} as const

// ── Generic helpers ───────────────────────────────────────────
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const redis = await getClient()
    const raw = await redis.get(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch (err) {
    console.error('[Cache] get error', key, err)
    return null
  }
}

export async function setCache<T>(key: string, value: T, ttl: number): Promise<void> {
  try {
    const redis = await getClient()
    await redis.set(key, JSON.stringify(value), { EX: ttl })
  } catch (err) {
    console.error('[Cache] set error', key, err)
  }
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    const redis = await getClient()
    if (keys.length) await redis.del(keys)
  } catch (err) {
    console.error('[Cache] invalidate error', keys, err)
  }
}

// ── Stale-while-revalidate wrapper ────────────────────────────
// Returns cached value immediately and silently refreshes in background
// when the TTL drops below `staleThreshold` seconds.
export async function swr<T>(
  key: string,
  ttl: number,
  fetcher: () => Promise<T>,
  staleThreshold = 60,
): Promise<T> {
  const redis = await getClient()

  const [raw, remaining] = await Promise.all([
    redis.get(key),
    redis.ttl(key),
  ])

  if (raw !== null) {
    // Return stale value; refresh in background if close to expiry
    if (remaining < staleThreshold) {
      fetcher()
        .then((fresh) => setCache(key, fresh, ttl))
        .catch((err)  => console.error('[Cache] SWR refresh failed', key, err))
    }
    return JSON.parse(raw) as T
  }

  // Cache miss – fetch, store, return
  const value = await fetcher()
  await setCache(key, value, ttl)
  return value
}

// ── Domain-specific cached fetchers ──────────────────────────

/** Collection rate = paid flats / total flats for current month (%) */
export async function getCachedCollectionRate(
  dbFetch: () => Promise<{ paid: number; total: number }>,
): Promise<{ paid: number; total: number; rate: number }> {
  return swr(KEYS.collectionRate, TTL.COLLECTION_RATE, async () => {
    const { paid, total } = await dbFetch()
    return { paid, total, rate: total > 0 ? Math.round((paid / total) * 100) : 0 }
  })
}

/** Defaulter count by aging bucket */
export async function getCachedDefaulterCount(
  dbFetch: () => Promise<{ bucket: string; count: number; totalDue: number }[]>,
): Promise<{ bucket: string; count: number; totalDue: number }[]> {
  return swr(KEYS.defaulterCount, TTL.DEFAULTER_COUNT, dbFetch)
}

/** Fund balance (credits, debits, net) */
export async function getCachedFundBalance(
  dbFetch: () => Promise<{ credits: number; debits: number; balance: number; lastTxAt: string }>,
): Promise<{ credits: number; debits: number; balance: number; lastTxAt: string }> {
  return swr(KEYS.fundBalance, TTL.FUND_BALANCE, dbFetch)
}

/** Income vs expense trend (12-month) */
export async function getCachedIncomeExpenseTrend(
  dbFetch: () => Promise<{ month: string; income: number; expense: number }[]>,
): Promise<{ month: string; income: number; expense: number }[]> {
  return swr(KEYS.incomeExpenseTrend, TTL.COLLECTION_RATE, dbFetch)
}
