import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, MapPin, Globe } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getOrgBySlug, getPublishedEvent, getActiveTicketTypes } from '@/lib/queries/events'
import { TicketTypeCard } from '@/components/public/ticket-type-card'
import { capitalize, formatDate, formatTime } from '@/lib/format'
import type { Event } from '@/types/database'

const MODALITY_LABEL: Record<Event['modality'], string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
}

type Params = Promise<{ slug: string; id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { slug, id } = await params
  const org = await getOrgBySlug(slug)
  const event = await getPublishedEvent(org.id, id)
  return {
    title: `${event.name} — ${org.name}`,
    description: event.description ?? undefined,
  }
}

export default async function EventDetailPage({ params }: { params: Params }) {
  const { slug, id } = await params
  const org = await getOrgBySlug(slug)
  const [event, ticketTypes] = await Promise.all([
    getPublishedEvent(org.id, id),
    getActiveTicketTypes(id),
  ])

  return (
    <div>
      {/* Cover hero */}
      <div className="relative h-56 md:h-72 bg-gradient-to-br from-primary/30 to-primary/10 overflow-hidden">
        {event.cover_url && (
          <Image
            src={event.cover_url}
            alt={event.name}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <Badge variant="secondary" className="mb-2">
            {MODALITY_LABEL[event.modality]}
          </Badge>
          <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">
            {event.name}
          </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <Link
          href={`/${slug}/eventos`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Todos los eventos
        </Link>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Info principal */}
          <div className="md:col-span-2 space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{capitalize(formatDate(event.starts_at))}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{formatTime(event.starts_at)}</span>
              </div>
              {event.ends_at && (
                <p className="text-sm text-muted-foreground pl-6">
                  Hasta el {capitalize(formatDate(event.ends_at))}
                </p>
              )}
              {event.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{event.location}</span>
                </div>
              )}
              {event.modality !== 'presencial' && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{MODALITY_LABEL[event.modality]}</span>
                </div>
              )}
            </div>

            {event.description && (
              <>
                <Separator />
                <div>
                  <h2 className="font-semibold mb-2">Acerca del evento</h2>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {event.description}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Tipos de inscripción */}
          <div className="space-y-4">
            <h2 className="font-semibold">Inscripción</h2>
            {ticketTypes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay tipos de inscripción disponibles en este momento.
              </p>
            ) : (
              ticketTypes.map((tt) => (
                <TicketTypeCard
                  key={tt.id}
                  ticketType={tt}
                  orgSlug={slug}
                  eventId={event.id}
                  allowPreregistration={event.allow_preregistration}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
