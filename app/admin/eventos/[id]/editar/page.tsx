import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUserProfile, getEventById, getEventTicketTypes, getAdminEventFields, getOrganizationSlug } from '@/lib/queries/admin'
import { updateEvent } from '@/lib/actions/events'
import { EventForm } from '@/components/admin/event-form'
import { TicketTypeSection } from '@/components/admin/ticket-type-section'
import { EventFieldsSection } from '@/components/admin/event-fields-section'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  return { title: `Editar evento — CEPROME Admin` }
}

export default async function EditarEventoPage({ params }: { params: Params }) {
  const { id } = await params

  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const [event, ticketTypes, eventFields, orgSlug] = await Promise.all([
    getEventById(id, profile.organization_id),
    getEventTicketTypes(id, profile.organization_id),
    getAdminEventFields(id, profile.organization_id),
    getOrganizationSlug(profile.organization_id),
  ])

  if (!event) notFound()

  const updateEventWithId = updateEvent.bind(null, id)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/eventos"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{event.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Editar evento</p>
        </div>
        <Link
          href={`/admin/inscritos?evento=${id}`}
          className="ml-auto text-sm text-primary hover:underline"
        >
          Ver inscritos →
        </Link>
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="text-sm font-semibold mb-4">Información general</h2>
        <EventForm
          action={updateEventWithId}
          defaultValues={event}
          orgSlug={orgSlug ?? undefined}
          submitLabel="Guardar cambios"
        />
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="text-sm font-semibold mb-4">Tipos de acceso</h2>
        <TicketTypeSection eventId={id} ticketTypes={ticketTypes} />
      </div>

      <div className="rounded-lg border p-6">
        <h2 className="text-sm font-semibold mb-1">Campos personalizados</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Aparecen en el formulario de inscripción pública. Los valores se guardan por asistente.
        </p>
        <EventFieldsSection eventId={id} fields={eventFields} />
      </div>
    </div>
  )
}
