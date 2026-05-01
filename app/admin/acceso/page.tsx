import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getAdminEvents, getEventRegistrations } from '@/lib/queries/admin'
import { AccesoPanel } from '@/components/admin/acceso-panel'

export const metadata = { title: 'Acceso en vivo — Admin' }

export default async function AccesoPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/auth/login')

  const events = await getAdminEvents(profile.organization_id)
  const activeEvents = events.filter((e) => ['published', 'closed'].includes(e.status))

  const defaultEvent = activeEvents[0] ?? null
  const initialRegistrations = defaultEvent
    ? await getEventRegistrations(defaultEvent.id, profile.organization_id)
    : []

  return (
    <AccesoPanel
      events={activeEvents}
      defaultEventId={defaultEvent?.id ?? null}
      initialRegistrations={initialRegistrations}
      orgId={profile.organization_id}
    />
  )
}
