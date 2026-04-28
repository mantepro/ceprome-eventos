import type { Metadata } from 'next'
import { getOrgBySlug, getPublishedEvent, getActiveTicketTypes, getEventFields } from '@/lib/queries/events'
import { RegistrationForm } from '@/components/public/registration-form'

type Params = Promise<{ slug: string; id: string }>
type SearchParams = Promise<{ tipo?: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, id } = await params
  const org = await getOrgBySlug(slug)
  const event = await getPublishedEvent(org.id, id)
  return { title: `Registro — ${event.name}` }
}

export default async function RegistrationPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { slug, id } = await params
  const { tipo } = await searchParams
  const org = await getOrgBySlug(slug)
  const [event, ticketTypes, eventFields] = await Promise.all([
    getPublishedEvent(org.id, id),
    getActiveTicketTypes(id),
    getEventFields(id),
  ])

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Formulario de inscripción</p>
      </div>
      <RegistrationForm
        event={event}
        ticketTypes={ticketTypes}
        orgSlug={slug}
        orgId={org.id}
        preselectedTypeId={tipo}
        eventFields={eventFields}
        allowPreregistration={event.allow_preregistration}
      />
    </div>
  )
}
