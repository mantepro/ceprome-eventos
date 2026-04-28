import { notFound } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { Scanner } from '@/components/scan/scanner'

type Params = Promise<{ 'event-id': string }>

export default async function ScanEventPage({ params }: { params: Params }) {
  const { 'event-id': eventId } = await params

  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const supabase = createAdminClient()
  const { data: event } = await supabase
    .from('events')
    .select('id, name, starts_at, status')
    .eq('id', eventId)
    .eq('organization_id', profile.organization_id)
    .eq('status', 'published')
    .single()

  if (!event) notFound()

  return <Scanner eventId={event.id} eventName={event.name} />
}
