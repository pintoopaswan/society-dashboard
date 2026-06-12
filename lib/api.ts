// lib/api.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://society-mgmt-api.vercel.app/api'

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const json = await res.json()
  if (!json.success) {
    const err: any = new Error(json.message ?? 'API error')
    // attach structured details if present so UI can render field errors
    if (json.details) err.details = json.details
    throw err
  }
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
  aadhaarLast4?: string; panNumber?: string
  ownerships?: { flat: { flatNumber: string; block: { name: string } } }[]
  tenancies?:  { flat: { flatNumber: string; block: { name: string } } }[]
  vehicles?: Vehicle[]
  createdAt?: string; updatedAt?: string
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

export type PaymentHistoryEntry = {
  // Transaction identity — primary key for edit/delete operations
  id:             string          // PaymentTransaction.id  ← this is the MASTER transaction id
  transactionRef: string | null   // human-readable TXN-xxxxxxxx

  // Payment details (stored once on the master transaction)
  date:         string            // ISO — processedAt
  amount:       number            // totalAmount = base + lateFee (the real collected figure)
  lateFee:      number
  mode:         string
  notes:        string | null

  // Month coverage — the canonical list this transaction covers
  paidMonths:   string[]          // ["2026-04","2026-05","2026-06"]
  billingMonth: string | null     // primary month (last in paidMonths)

  // Flat context
  block:        string | null
  flatNumber:   string | null

  // Receipt
  receiptNumber: string | null
}

export type Tenancy = {
  id: string; residentId: string; flatId: string; startDate: string; endDate?: string
  rentAmount?: number; deposit?: number; createdAt?: string; endedAt?: string
}

export type Vehicle = {
  id: string; residentId: string; flatId?: string; type: 'CAR' | 'BIKE' | 'SCOOTER' | 'CYCLE' | 'OTHER' | string;
  plateNumber: string; make?: string; model?: string; color?: string; parkingSlot?: string; createdAt?: string
}

export type RecordPaymentByFlatPayload = {
  blockName:    string
  flatNumber:   string
  billingMonth: string | string[]  // "2026-05"  or  ["2026-03","2026-04","2026-05"]
  amount:       number             // base amount (excl. lateFee)
  mode:         'ONLINE' | 'CASH'
  paidAt:       string             // ISO-8601 with offset, e.g. "2026-05-12T10:30:00+05:30"
  lateFee?:     number
  notes?:       string
}

export type EditPaymentPayload = {
  mode?:    'ONLINE' | 'CASH' | 'UPI' | 'NEFT' | 'CHEQUE'
  paidAt?:  string    // ISO-8601 with offset
  amount?:  number    // base amount excl. lateFee
  lateFee?: number
  notes?:   string
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
  updateResident: (id: string, data: Partial<Person>) =>
    req<Person>(`/residents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteResident: (id: string) =>
    req<any>(`/residents/${id}`, { method: 'DELETE' }),

  // Resident related actions
  addTenancy: (residentId: string, data: { flatId: string; startDate: string; rentAmount?: number; deposit?: number }) =>
    req<Tenancy>(`/residents/${residentId}/tenancy`, { method: 'POST', body: JSON.stringify(data) }),
  endTenancy: (residentId: string, tenancyId: string, data?: { endDate?: string }) =>
    req<any>(`/residents/${residentId}/tenancy/${tenancyId}/end`, { method: 'PATCH', body: JSON.stringify(data || {}) }),
  updateTenancy: (residentId: string, tenancyId: string, data: Partial<Tenancy>) =>
    req<Tenancy>(`/residents/${residentId}/tenancy/${tenancyId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  addVehicle: (residentId: string, data: { flatId: string; type: 'CAR' | 'BIKE' | 'SCOOTER' | 'CYCLE' | 'OTHER' | string; plateNumber: string; make?: string; model?: string; color?: string; parkingSlot?: string }) =>
    req<Vehicle>(`/residents/${residentId}/vehicle`, { method: 'POST', body: JSON.stringify(data) }),
  updateVehicle: (residentId: string, vehicleId: string, data: Partial<Vehicle>) =>
    req<Vehicle>(`/residents/${residentId}/vehicle/${vehicleId}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteVehicle: (residentId: string, vehicleId: string) =>
    req<any>(`/residents/${residentId}/vehicle/${vehicleId}`, { method: 'DELETE' }),

  getResidentPayments: (residentId: string) => req<any>(`/residents/${residentId}/payments`),

  // Payments
  getPayments:    (params = '') => req<Payment[]>(`/payments${params}`),
  getDefaulters:  ()            => req<any[]>('/payments/defaulters'),
  getSummary:     (month: string) => req<any>(`/payments/summary/${month}`),
  generateBills:  (billingMonth: string, amount = 200) =>
    req<any>('/payments/generate-bills', { method: 'POST', body: JSON.stringify({ billingMonth, amount }) }),
  recordPayment:  (id: string, data: { mode: string; lateFee?: number; notes?: string }) =>
    req<Payment>(`/payments/${id}/record`, { method: 'POST', body: JSON.stringify(data) }),
  recordPaymentByFlat: (data: RecordPaymentByFlatPayload) =>
    req<Payment>('/payments/record-by-flat', { method: 'POST', body: JSON.stringify(data) }),

  // Edit/delete operate on the master PaymentTransaction id (entry.id from getPaymentHistory)
  editPayment: (transactionId: string, data: EditPaymentPayload) =>
    req<Payment>(`/payments/transaction/${transactionId}/edit`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Single DELETE call — the server now reverses all covered months in one go
  deletePayment: (transactionId: string) =>
    req<any>(`/payments/transaction/${transactionId}`, { method: 'DELETE' }),

  markOverdue:    () => req<any>('/payments/mark-overdue', { method: 'PATCH' }),
  getPaymentHistory: (params?: { year?: string; month?: string; block?: string }) => {
    const p = new URLSearchParams()
    if (params?.year)  p.set('year',  params.year)
    if (params?.month) p.set('month', params.month)
    if (params?.block) p.set('block', params.block)
    const qs = p.toString()
    return req<PaymentHistoryEntry[]>(`/payments/history/summary${qs ? '?' + qs : ''}`)
  },

  // Announcements
  getAnnouncements: () => req<any[]>('/dashboard/announcements'),
  addAnnouncement:  (data: any) =>
    req<any>('/dashboard/announcements', { method: 'POST', body: JSON.stringify(data) }),
}

// ── Report Types ──────────────────────────────────────────────

export type CollectionReportMonth = {
  billingMonth:    string   // "2026-06"
  total:           number   // total bills generated
  paid:            number
  pending:         number
  overdue:         number
  totalCollected:  number
  totalDue:        number
  collectionRate:  number   // 0-100 %
  onlineCount:     number
  cashCount:       number
}

export type CollectionReport = {
  current:   CollectionReportMonth
  previous:  CollectionReportMonth
  mom: {
    amountDelta: number   // absolute ₹ change
    amountPct:   number   // month-over-month % change
    rateDelta:   number   // percentage-point change in collection rate
    trend:       'up' | 'down' | 'flat'
  }
  trend12m: {
    month:     string   // "YYYY-MM"
    collected: number
    payments:  number
  }[]
  byBlock: {
    block:     string
    collected: number
    payments:  number
    share:     number   // % of grand total
  }[]
  generatedAt: string   // ISO timestamp
}

export type DefaulterEntry = {
  flatId:       string
  flatNumber:   string
  block:        string
  residentName: string | null
  phone:        string | null
  unpaidMonths: number
  totalDue:     number
  oldestDue:    string | null   // ISO timestamp of earliest unpaid due date
  daysOverdue:  number
  agingBucket:  '0-30' | '31-60' | '60+'
}

export type DefaultersReport = {
  defaulters: DefaulterEntry[]
  total: {
    count:    number
    totalDue: number
  }
  buckets: {
    bucket:   '0-30' | '31-60' | '60+'
    count:    number
    totalDue: number
  }[]
  page:        number
  pageSize:    number
  totalPages:  number
  generatedAt: string
}

// ── Report API calls ──────────────────────────────────────────

export const reports = {
  /**
   * Collection report for a given billing month.
   * month must be "YYYY-MM" (e.g. "2026-06"). Defaults to current month if omitted.
   * Includes current vs previous month, MoM delta, 12-month trend, and per-block breakdown.
   */
  getCollection: (month?: string) => {
    const qs = month ? `?month=${month}` : ''
    return req<CollectionReport>(`/reports/collection${qs}`)
  },

  /**
   * Defaulters with aging buckets.
   * bucket: 'all' | '0-30' | '31-60' | '60+'
   * page / limit control pagination (backend max limit: 100).
   */
  getDefaulters: (
    bucket: 'all' | '0-30' | '31-60' | '60+' = 'all',
    page   = 1,
    limit  = 20,
  ) =>
    req<DefaultersReport>(
      `/reports/defaulters?bucket=${encodeURIComponent(bucket)}&page=${page}&limit=${limit}`
    ),
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