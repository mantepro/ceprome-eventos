import Image from 'next/image'
import { headers } from 'next/headers'
import { Calendar, MapPin, Globe, Building2, Hotel, Mail, Phone, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getOrgBySlug, getPublishedEventBySlug, getActiveTicketTypes } from '@/lib/queries/events'
import { TicketTypeCard } from '@/components/public/ticket-type-card'
import { CountdownTimer } from '@/components/public/countdown-timer'
import { capitalize, formatDate } from '@/lib/format'
import { publicBasePath } from '@/lib/org-domain'
import type { Event } from '@/types/database'

const MODALITY_LABEL: Record<Event['modality'], string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
}

type Params = Promise<{ slug: string; eventSlug: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { slug, eventSlug } = await params
  const org = await getOrgBySlug(slug)
  const event = await getPublishedEventBySlug(org.id, eventSlug)
  return {
    title: `${event.name} — ${org.name}`,
    description: event.description ?? undefined,
  }
}

export default async function EventDetailPage({ params }: { params: Params }) {
  const { slug, eventSlug } = await params
  const org = await getOrgBySlug(slug)
  const event = await getPublishedEventBySlug(org.id, eventSlug)
  const ticketTypes = await getActiveTicketTypes(event.id)
  const basePath = publicBasePath(org, (await headers()).get('host'))

  return (
    <div>
      {/* Hero */}
      <section className="grid md:grid-cols-2">
        <div className="flex flex-col justify-center gap-6 bg-[#a22944] px-6 py-14 text-white md:px-12 md:py-20 lg:px-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/80 md:text-sm">
            VI Congreso Latinoamericano
          </p>
          <h1 className="text-3xl font-bold leading-tight md:text-5xl">{event.name}</h1>

          <div className="space-y-1.5 text-sm text-white/90">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>{capitalize(formatDate(event.starts_at))}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{event.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 shrink-0" />
              <span>{MODALITY_LABEL[event.modality]}</span>
            </div>
          </div>

          {event.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/90 md:text-base">
              {event.description}
            </p>
          )}

          <div>
            <Button asChild size="lg" className="bg-white text-[#a22944] hover:bg-white/90">
              <a href="#tipos-de-acceso">Registrarme al congreso</a>
            </Button>
          </div>

          <CountdownTimer targetDate={event.starts_at} />
        </div>

        <div className="relative min-h-[260px] bg-muted md:min-h-0">
          {event.cover_url ? (
            <Image
              src={event.cover_url}
              alt={event.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full min-h-[260px] items-center justify-center bg-gray-200">
              <span className="text-sm font-medium uppercase tracking-widest text-gray-400">
                Fotografía real
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Tipos de acceso */}
      <section id="tipos-de-acceso" className="container mx-auto px-4 py-12 md:py-16">
        <h2 className="mb-6 text-2xl font-bold">Tipos de acceso</h2>
        {ticketTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay tipos de inscripción disponibles en este momento.
          </p>
        ) : (
          <>
            <div className="mb-8 rounded-lg border bg-muted/30 px-5 py-4 max-w-2xl">
              <p className="font-semibold text-sm mb-2">Así funciona tu inscripción</p>
              <ol className="space-y-1 text-sm text-muted-foreground list-decimal list-inside">
                <li>Elige tu tipo de acceso y completa tus datos para apartar tu lugar.</li>
                <li className="text-[15px] font-semibold text-foreground">
                  El pago es opcional en este paso: puedes pagarlo en línea de inmediato, dejarlo
                  pendiente para pagar después, o simplemente reservar tu lugar sin pagar todavía.
                </li>
                <li>Si decides pagar más adelante, te enviaremos las instrucciones por correo después de completar tu registro.</li>
              </ol>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {ticketTypes.map((tt, i) => (
                <TicketTypeCard
                  key={tt.id}
                  ticketType={tt}
                  basePath={basePath}
                  eventSlug={eventSlug}
                  primary={i === 0}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Información práctica */}
      <section className="bg-muted/40 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <h2 className="mb-8 text-2xl font-bold">Información práctica</h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="space-y-2">
              <Building2 className="h-5 w-5 text-[#a22944]" />
              <h3 className="font-semibold">Sede</h3>
              <p className="text-sm text-muted-foreground">
                {event.location ?? 'Por confirmar'}
              </p>
              <p className="text-sm text-muted-foreground">{MODALITY_LABEL[event.modality]}</p>
            </div>
            <div className="space-y-2">
              <Hotel className="h-5 w-5 text-[#a22944]" />
              <h3 className="font-semibold">Hospedaje</h3>
              <p className="text-sm text-muted-foreground">
                Consulta la sede, hospedaje recomendado y toda la información del congreso en{' '}
                <a
                  href="https://congreso.cepromelat.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#a22944] underline underline-offset-2 font-medium"
                >
                  congreso.cepromelat.com
                </a>
                .
              </p>
            </div>
            <div className="space-y-2">
              <Mail className="h-5 w-5 text-[#a22944]" />
              <h3 className="font-semibold">Contacto</h3>
              {org.email && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{org.email}</span>
                </p>
              )}
              {org.phone && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{org.phone}</span>
                </p>
              )}
              {org.whatsapp_contact && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>WhatsApp: {org.whatsapp_contact}</span>
                </p>
              )}
              {!org.email && !org.phone && (
                <p className="text-sm text-muted-foreground">
                  Contacto disponible próximamente.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
