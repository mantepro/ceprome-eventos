import { Calendar } from 'lucide-react'
import { getOrgBySlug, getPublishedEvents } from '@/lib/queries/events'
import { EventCard } from '@/components/public/event-card'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await getOrgBySlug(slug)
  return { title: `Eventos — ${org.name}` }
}

export default async function EventsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await getOrgBySlug(slug)
  const events = await getPublishedEvents(org.id)

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-28 text-center px-4">
        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">No hay eventos disponibles</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Próximamente habrá eventos para registrarse.
        </p>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Eventos</h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} orgSlug={slug} />
        ))}
      </div>
    </div>
  )
}
