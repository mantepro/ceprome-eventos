import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getOrgBySlug, getPublishedEvent, getActiveTicketTypes, getEventFields } from '@/lib/queries/events'
import { RegistrationForm } from '@/components/public/registration-form'

type Params = Promise<{ slug: string; id: string }>
type SearchParams = Promise<{ tipo?: string; prereg?: string }>

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
  const { tipo, prereg } = await searchParams
  const org = await getOrgBySlug(slug)
  const [event, ticketTypes, eventFields] = await Promise.all([
    getPublishedEvent(org.id, id),
    getActiveTicketTypes(id),
    getEventFields(id),
  ])

  return (
    <div className="registro-form min-h-screen bg-[#f9fafb]">
      <div className="sticky top-0 z-40 border-b bg-white">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
          <div className="relative h-7 w-28 shrink-0">
            {org.logo_url ? (
              <Image
                src={org.logo_url}
                alt={org.name}
                fill
                className="object-contain object-left"
                sizes="112px"
              />
            ) : (
              <span className="text-sm font-semibold text-foreground">{org.name}</span>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">{event.name}</p>
          <Link
            href={`/${slug}/eventos/${event.id}`}
            className="shrink-0 text-sm font-medium text-[#a22944] hover:underline"
          >
            Guardar y salir
          </Link>
        </div>
      </div>

      <div className="px-4 py-10">
        <RegistrationForm
          event={event}
          ticketTypes={ticketTypes}
          orgSlug={slug}
          orgId={org.id}
          preselectedTypeId={tipo}
          preselectedPayment={prereg === '1' ? 'preregister' : undefined}
          eventFields={eventFields}
          allowPreregistration={event.allow_preregistration}
        />
      </div>
    </div>
  )
}
