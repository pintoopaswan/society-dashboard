// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://society-mgmt-api.vercel.app/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.message ?? 'API error')
  return json.data as T
}

// ── Types ─────────────────────────────────────────────────────

export type Block = {
  id: string; name: string; totalFlats: number; vacant: number; occupied: number
}

export type Flat = {
  id: string; blockId: string; flatNumber: string; floor: number
  status: 'VACANT' | 'OWNER_OCCUPIED' | 'RENTED' | 'LOCKED'
  monthlyMaintenance: number; isActive: boolean
  block?: { name: string }
  ownerships?: { person: { name: string; phone: string } }[]
  tenancies?:  { person: { name: string; phone: string } }[]
}

export type Person = {
  id: string; name: string; phone: string; email?: string; isActive: boolean
  ownerships?: { flat: { flatNumber: string; block: { name: string } } }[]
  tenancies?:  { flat: { flatNumber: string; block: { name: string } } }[]
}

export type Payment = {
  id: string; flatId: string; billingMonth: string
  amount: number; lateFee: number; totalAmount: number
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PARTIAL' | 'WAIVED'
  dueDate: string; paidAt?: string
  flat?: { flatNumber: string; block: { name: string }; ownerships?: { person: { name: string; phone: string } }[] }
  receipt?: { receiptNumber: string }
}

export type DashboardData = {
  flats:     { total: number; occupied: number; vacant: number }
  residents: { total: number }
  currentMonth: {
    billingMonth: string; paid: number; pending: number; overdue: number
    collected: number; collectionRate: number
  }
  fund:            { balance: number; asOf: string }
  recentPayments:  Payment[]
  topDefaulters:   { block: string; flatNumber: string; unpaidMonths: number; totalDue: number }[]
}

export type Expense = {
  id: string; category: string; description: string
  amount: number; vendor?: string; expenseDate: string
}

// ── API calls ─────────────────────────────────────────────────

export const api = {
  // Dashboard
  getDashboard:  ()     => req<DashboardData>('/dashboard'),
  getFundLedger: (page = 1) => req<{ entries: any[]; total: number }>(`/dashboard/fund-ledger?page=${page}`),
  getExpenses:   ()     => req<Expense[]>('/dashboard/expenses'),
  addExpense:    (data: Omit<Expense, 'id'>) =>
    req<Expense>('/dashboard/expenses', { method: 'POST', body: JSON.stringify(data) }),

  // Blocks & Flats
  getBlocks: ()          => req<Block[]>('/blocks'),
  getFlats:  (params = '') => req<Flat[]>(`/flats${params}`),
  getFlat:   (id: string)  => req<Flat>(`/flats/${id}`),

  // Residents
  getResidents: (q = '')   => req<Person[]>(`/residents${q ? `?q=${q}` : ''}`),
  getResident:  (id: string) => req<Person>(`/residents/${id}`),
  addResident:  (data: Partial<Person>) =>
    req<Person>('/residents', { method: 'POST', body: JSON.stringify(data) }),

  // Payments
  getPayments:    (params = '') => req<Payment[]>(`/payments${params}`),
  getDefaulters:  ()            => req<any[]>('/payments/defaulters'),
  getSummary:     (month: string) => req<any>(`/payments/summary/${month}`),
  generateBills:  (billingMonth: string, amount = 200) =>
    req<any>('/payments/generate-bills', { method: 'POST', body: JSON.stringify({ billingMonth, amount }) }),
  recordPayment:  (id: string, data: { mode: string; lateFee?: number; notes?: string }) =>
    req<Payment>(`/payments/${id}/record`, { method: 'POST', body: JSON.stringify(data) }),
  markOverdue:    () => req<any>('/payments/mark-overdue', { method: 'PATCH' }),

  // Announcements
  getAnnouncements: () => req<any[]>('/dashboard/announcements'),
  addAnnouncement:  (data: any) =>
    req<any>('/dashboard/announcements', { method: 'POST', body: JSON.stringify(data) }),
}

// Search
export const searchAll = (
  q: string,
  opts?: { limit?: number; offset?: number },
  init?: RequestInit
) => {
  const params = [`q=${encodeURIComponent(q)}`]
  if (opts?.limit) params.push(`limit=${opts.limit}`)
  if (opts?.offset) params.push(`offset=${opts.offset}`)
  return req<any[]>(`/search?${params.join('&')}`, init)
}