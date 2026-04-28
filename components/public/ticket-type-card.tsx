import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/format'
import type { TicketType } from '@/types/database'

interface Props {
  ticketType: TicketType
  orgSlug: string
  eventId: string
  allowPreregistration?: boolean
}

function getAvailability(tt: TicketType): { label: string; urgent: boolean; available: boolean } {
  if (tt.capacity === null) return { label: 'Disponible', urgent: false, available: true }
  const remaining = tt.capacity - tt.sold_count
  if (remaining <= 0) return { label: 'Agotado', urgent: false, available: false }
  if (remaining <= 10) return { label: `Últimos ${remaining} lugares`, urgent: true, available: true }
  return { label: 'Disponible', urgent: false, available: true }
}

export function TicketTypeCard({ ticketType, orgSlug, eventId, allowPreregistration = false }: Props) {
  const { label, urgent, available } = getAvailability(ticketType)
  const base = `/${orgSlug}/registro/${eventId}?tipo=${ticketType.id}`

  return (
    <Card className={!available ? 'opacity-60' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">{ticketType.name}</CardTitle>
          <Badge
            variant={urgent ? 'destructive' : available ? 'outline' : 'secondary'}
            className="text-xs shrink-0"
          >
            {label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <p className="text-3xl font-bold tracking-tight">
          {ticketType.price === 0
            ? 'Gratuito'
            : formatPrice(ticketType.price, ticketType.currency)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{ticketType.currency}</p>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {available ? (
          <>
            <Button asChild className="w-full">
              <Link href={base}>Registrarme y pagar</Link>
            </Button>
            {allowPreregistration && (
              <Button asChild variant="outline" className="w-full">
                <Link href={`${base}&prereg=1`}>Pre-registrarme</Link>
              </Button>
            )}
          </>
        ) : (
          <Button className="w-full" disabled>
            No disponible
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
