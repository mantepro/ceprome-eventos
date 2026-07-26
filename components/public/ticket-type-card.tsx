import Link from 'next/link'
import { Check } from 'lucide-react'
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
  primary?: boolean
}

const INCLUDED_BENEFITS = [
  'Acceso a todas las conferencias y simposios',
  'Kit de inscripción',
  'Constancia de participación',
]

function getAvailability(tt: TicketType): { label: string; urgent: boolean; available: boolean } {
  if (tt.capacity === null) return { label: 'Disponible', urgent: false, available: true }
  const remaining = tt.capacity - tt.sold_count
  if (remaining <= 0) return { label: 'Agotado', urgent: false, available: false }
  if (remaining <= 10) return { label: `Últimos ${remaining} lugares`, urgent: true, available: true }
  return { label: 'Disponible', urgent: false, available: true }
}

export function TicketTypeCard({
  ticketType,
  orgSlug,
  eventId,
  allowPreregistration = false,
  primary = false,
}: Props) {
  const { label, urgent, available } = getAvailability(ticketType)
  const base = `/${orgSlug}/registro/${eventId}?tipo=${ticketType.id}`

  return (
    <Card className={!available ? 'opacity-60' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg font-semibold">{ticketType.name}</CardTitle>
          {urgent && (
            <Badge variant="destructive" className="text-xs shrink-0">
              {label}
            </Badge>
          )}
          {!available && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pb-3">
        <div>
          <p className="text-3xl font-bold tracking-tight">
            {ticketType.price === 0
              ? 'Gratuito'
              : formatPrice(ticketType.price, ticketType.currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{ticketType.currency}</p>
        </div>
        <ul className="space-y-2">
          {INCLUDED_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#a22944]" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {available ? (
          <>
            <Button
              asChild
              variant={primary ? 'default' : 'outline'}
              className={
                primary
                  ? 'w-full bg-[#a22944] text-white hover:bg-[#8a2239]'
                  : 'w-full border-[#a22944] text-[#a22944] hover:bg-[#a22944]/10 hover:text-[#a22944]'
              }
            >
              <Link href={base}>Elegir este acceso</Link>
            </Button>
            {allowPreregistration && (
              <Button asChild variant="ghost" className="w-full">
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
