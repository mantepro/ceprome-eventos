import Link from 'next/link'
import Image from 'next/image'
import { Calendar, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDateShort } from '@/lib/format'
import type { Event } from '@/types/database'

const MODALITY_LABEL: Record<Event['modality'], string> = {
  presencial: 'Presencial',
  virtual: 'Virtual',
  hibrido: 'Híbrido',
}

interface Props {
  event: Event
  orgSlug: string
}

export function EventCard({ event, orgSlug }: Props) {
  return (
    <Link href={`/${orgSlug}/eventos/${event.id}`} className="group">
      <Card className="overflow-hidden h-full transition-shadow group-hover:shadow-md">
        <div className="relative h-44 bg-gradient-to-br from-primary/20 to-primary/5">
          {event.cover_url && (
            <Image
              src={event.cover_url}
              alt={event.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          )}
        </div>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors">
              {event.name}
            </h3>
            <Badge variant="secondary" className="shrink-0 text-xs">
              {MODALITY_LABEL[event.modality]}
            </Badge>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span>{formatDateShort(event.starts_at)}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
