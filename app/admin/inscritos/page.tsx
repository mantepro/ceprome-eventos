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
      </div>

      <RegistrationsTable
        registrations={registrations}
        orgFields={orgFields}
        orgId={profile.organization_id}
        isSuperAdmin={profile.role === 'super_admin'}
        hideFinancials={profile.hide_financials}
      />
    </div>
  )
}
