import type { Metadata } from 'next'
import { getRegistrationByFolio } from '@/lib/queries/registrations'
import { PayPalButton } from '@/components/public/paypal-button'
import { formatDate } from '@/lib/utils'

type Params = Promise<{ slug: string; folio: string }>
type SearchParams = Promise<{ pago?: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { folio } = await params
  return { title: `Confirmación — ${folio}` }
}

export default async function ConfirmationPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { slug, folio } = await params
  const { pago } = await searchParams
  const reg = await getRegistrationByFolio(folio)

  const attendee = reg.attendees[0]
  const ticket = reg.tickets[0]
  const isPaid = reg.status === 'paid'
  const isOnline = reg.payment_method === 'online'
  const isManual = reg.payment_method === 'manual'

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <div className="text-center mb-8">
        <div
          className={`inline-flex h-16 w-16 items-center justify-center rounded-full text-3xl mb-4 ${
            isPaid
              ? 'bg-green-100 text-green-600'
              : pago === 'fallido' || pago === 'cancelado'
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-600'
          }`}
        >
          {isPaid ? '✓' : pago === 'fallido' || pago === 'cancelado' ? '!' : '⏳'}
        </div>
        <h1 className="text-2xl font-bold">
          {isPaid ? '¡Pago confirmado!' : '¡Inscripción recibida!'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isPaid
            ? 'Tu ticket QR será enviado por correo en breve.'
            : 'Completa tu pago para confirmar el lugar.'}
        </p>
      </div>

      {pago === 'fallido' && !isPaid && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive text-center">
          El pago no pudo procesarse. Intenta de nuevo.
        </div>
      )}
      {pago === 'cancelado' && !isPaid && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 text-center">
          Cancelaste el pago. Puedes intentarlo cuando quieras.
        </div>
      )}

      <div className="rounded-lg border divide-y text-sm mb-6">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-muted-foreground">Folio</span>
          <span className="font-mono font-bold text-base">{reg.folio}</span>
        </div>

        {reg.events && (
          <div className="px-4 py-3">
            <p className="text-muted-foreground mb-1">Evento</p>
            <p className="font-medium">{reg.events.name}</p>
            <p className="text-muted-foreground">{formatDate(reg.events.starts_at)}</p>
            {reg.events.location && (
              <p className="text-muted-foreground">{reg.events.location}</p>
            )}
          </div>
        )}

        {attendee && (
          <div className="px-4 py-3">
            <p className="text-muted-foreground mb-1">Asistente</p>
            <p className="font-medium">
              {attendee.first_name} {attendee.last_name}
            </p>
            <p className="text-muted-foreground">{attendee.email}</p>
          </div>
        )}

        {ticket?.ticket_types && (
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground mb-1">Inscripción</p>
              <p className="font-medium">{ticket.ticket_types.name}</p>
            </div>
            <p className="font-bold">
              ${ticket.ticket_types.price.toLocaleString()}{' '}
              <span className="font-normal text-muted-foreground">
                {ticket.ticket_types.currency}
              </span>
            </p>
          </div>
        )}

        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-muted-foreground">Estado</span>
          <StatusBadge status={reg.status} />
        </div>
      </div>

      {isPaid ? (
        <div className="rounded-lg border bg-green-50 border-green-200 px-4 py-4 text-center space-y-1">
          <p className="font-semibold text-green-900">Pago confirmado</p>
          <p className="text-sm text-green-800">
            Tu ticket con código QR será enviado a{' '}
            <strong>{attendee?.email}</strong>.
          </p>
        </div>
      ) : isOnline ? (
        <div className="space-y-3">
          <PayPalButton folio={folio} orgSlug={slug} />
          <p className="text-xs text-center text-muted-foreground">
            Pago seguro procesado por PayPal
          </p>
        </div>
      ) : isManual ? (
        <div className="rounded-lg border bg-amber-50 border-amber-200 px-4 py-4 space-y-2">
          <p className="font-semibold text-amber-900">Instrucciones de pago</p>
          <p className="text-sm text-amber-800">
            Realiza tu transferencia o depósito y envía el comprobante al correo
            del organizador.
          </p>
          {reg.organizations?.email && (
            <p className="text-sm font-medium text-amber-900">
              {reg.organizations.email}
            </p>
          )}
          <p className="text-xs text-amber-700 mt-2">
            Incluye tu folio <strong>{reg.folio}</strong> en el concepto del pago.
          </p>
        </div>
      ) : null}

      {!isPaid && (
        <p className="text-xs text-center text-muted-foreground mt-6">
          Tu ticket con código QR será enviado a{' '}
          <strong>{attendee?.email}</strong> una vez confirmado el pago.
        </p>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pendiente de pago', className: 'bg-amber-100 text-amber-800' },
    paid: { label: 'Pagado', className: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
    draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-800' },
  }
  const s = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' }
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.className}`}>
      {s.label}
    </span>
  )
}
