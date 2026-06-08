import { api, Person } from '@/lib/api'
import ResidentProfile from './components/ResidentProfile'
import TenancySection from './components/TenancySection'
import VehiclesSection from './components/VehiclesSection'
import PaymentsSection from './components/PaymentsSection'

type Props = { params: { id: string } }

export default async function ResidentPage({ params }: Props) {
  const resident = await api.getResident(params.id)
  // determine active flat from tenancies: prefer tenancy without endDate, else latest by startDate
  const tenancies = (resident as any).tenancies || []
  let currentFlatId: string | null = null
  if (tenancies.length > 0) {
    const active = tenancies.find((t: any) => !t.endDate)
    const latest = tenancies.slice().sort((a: any, b: any) => (a.startDate < b.startDate ? 1 : -1))[0]
    currentFlatId = (active || latest)?.flat?.id || null
  }

  return (
    <div className="space-y-6">
      <div className="fade-up">
        <h1 className="page-title">Resident Profile</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1">
          <ResidentProfile resident={resident as Person} />
        </div>

        <div className="col-span-1 lg:col-span-2 space-y-4">
          <TenancySection residentId={params.id} tenancies={(resident as any).tenancies || []} />
          <VehiclesSection residentId={params.id} vehicles={(resident as any).vehicles || []} currentFlatId={currentFlatId} />
          <PaymentsSection residentId={params.id} />
        </div>
      </div>
    </div>
  )
}
