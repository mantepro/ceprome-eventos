import { getCurrentUserProfile, getRegistrations, getOrgFields } from '@/lib/queries/admin'
import { RegistrationsTable } from '@/components/admin/registrations-table'

export const metadata = { title: 'Inscritos — CEPROME Admin' }

export default async function InscritosPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const [registrations, orgFields] = await Promise.all([
    getRegistrations(profile.organization_id),
    getOrgFields(profile.organization_id),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inscritos</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {registrations.length} inscripción{registrations.length !== 1 ? 'es' : ''} en total
        </p>
      </div>

      <RegistrationsTable
        registrations={registrations}
        orgFields={orgFields}
        orgId={profile.organization_id}
      />
    </div>
  )
}
