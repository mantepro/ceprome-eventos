import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getRegistrationByFolio } from '@/lib/queries/registrations'
import { PayPalFromPagarButton } from '@/components/public/paypal-from-pagar-button'
import { formatDate, formatCurrency } from '@/lib/utils'

type Params = Promise<{ slug: string; folio: string }>
type SearchParams = Promise<{ pago?: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { folio } = await params
  return { title: `Completar pago — ${folio}` }
}

export default async function PagarPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { slug, folio } = await params
  const { pago } = await searchParams

  let reg
  try {
    reg = await getRegistrationByFolio(folio)
  } catch {
    notFound()
  }

  const attendee = reg.attendees[0]
  const ticket = reg.tickets[0]
  const isPaid = reg.status === 'paid'
  const isCancelled = reg.status === 'cancelled'
  const isActive = reg.status === 'draft' || reg.status === 'pending'

  const transferInstructions = reg.events?.transfer_instructions ?? null
  const orgEmail = reg.organizations?.email ?? null
  const whatsappContact = reg.organizations?.whatsapp_contact ?? null

  if (isCancelled) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 text-3xl mb-4">!</div>
        <h1 className="text-xl font-bold">Inscripción cancelada</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Esta inscripción fue cancelada. Contacta al organizador si crees que es un error.
        </p>
        {orgEmail && <p className="mt-3 text-sm font-medium">{orgEmail}</p>}
        {whatsappContact && (
          <p className="mt-1 text-sm text-muted-foreground">WhatsApp: {whatsappContact}</p>
        )}
      </div>
    )
  }

  if (isPaid) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 text-3xl mb-4">✓</div>
        <h1 className="text-xl font-bold">¡Pago confirmado!</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Tu lugar está asegurado. Revisa tu correo para encontrar tu ticket QR.
        </p>
        <div className="mt-6 rounded-lg border divide-y text-sm text-left">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-muted-foreground">Folio</span>
            <span className="font-mono font-bold">{reg.folio}</span>
          </div>
          {reg.events && (
            <div className="px-4 py-3">
              <p className="font-medium">{reg.events.name}</p>
              <p className="text-muted-foreground text-xs mt-0.5">{formatDate(reg.events.starts_at)}</p>
            </div>
          )}
          {attendee && (
            <div className="px-4 py-3">
              <p className="font-medium">{attendee.first_name} {attendee.last_name}</p>
              <p className="text-muted-foreground text-xs">{attendee.email}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!isActive) notFound()

  return (
    <div className="container mx-auto px-4 py-8 max-w-xl">
      <div className="text-center mb-8">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-3xl mb-4">
          💳
        </div>
        <h1 className="text-2xl font-bold">Completa tu pago</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Tu lugar está reservado. Elige cómo quieres pagar.
        </p>
      </div>

      {pago === 'cancelado' && (
        <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 text-center">
          Cancelaste el pago. Puedes intentarlo cuando quieras.
        </div>
      )}

      {/* Resumen */}
      <div className="rounded-lg border divide-y text-sm mb-6">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-muted-foreground">Folio</span>
          <span className="font-mono font-bold text-base">{reg.folio}</span>
        </div>
        {reg.events && (
          <div className="px-4 py-3">
            <p className="text-muted-foreground mb-1">Evento</p>
            <p className="font-medium">{reg.events.name}</p>
            <p className="text-muted-foreground text-xs">
              {formatDate(reg.events.starts_at)}
              {reg.events.location && ` · ${reg.events.location}`}
            </p>
          </div>
        )}
        {attendee && (
          <div className="px-4 py-3">
            <p className="text-muted-foreground mb-1">Asistente</p>
            <p className="font-medium">{attendee.first_name} {attendee.last_name}</p>
            <p className="text-muted-foreground text-xs">{attendee.email}</p>
          </div>
        )}
        {ticket?.ticket_types && (
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-muted-foreground mb-1">Inscripción</p>
              <p className="font-medium">{ticket.ticket_types.name}</p>
            </div>
            <p className="font-bold text-base">
              {formatCurrency(ticket.ticket_types.price, ticket.ticket_types.currency)}
            </p>
          </div>
        )}
        {reg.discount_amount > 0 && (
          <div className="px-4 py-3 flex items-center justify-between text-green-700">
            <span>Descuento aplicado</span>
            <span className="font-medium">
              -{formatCurrency(reg.discount_amount, ticket?.ticket_types?.currency ?? 'USD')}
            </span>
          </div>
        )}
        <div className="px-4 py-3 flex items-center justify-between font-bold">
          <span>Total</span>
          <span className="text-base">
            {formatCurrency(reg.total_amount, ticket?.ticket_types?.currency ?? 'USD')}
          </span>
        </div>
      </div>

      {/* Opción 1: PayPal */}
      <div className="rounded-lg border mb-4">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-semibold">Pagar con PayPal o tarjeta</p>
        </div>
        <div className="px-4 py-4 space-y-2">
          <PayPalFromPagarButton folio={folio} orgSlug={slug} />
          <p className="text-xs text-center text-muted-foreground">
            Pago seguro procesado por PayPal
          </p>
        </div>
      </div>

      {/* Opción 2: Transferencia */}
      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/30">
          <p className="text-sm font-semibold">Transferencia bancaria</p>
        </div>
        <div className="px-4 py-4 space-y-3">
          {transferInstructions ? (
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {transferInstructions}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Para instrucciones de pago por transferencia, contacta al organizador del evento.
            </p>
          )}
          {orgEmail && (
            <p className="text-sm">
              <span className="text-muted-foreground">Correo: </span>
              <strong>{orgEmail}</strong>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Incluye tu folio <strong className="font-mono">{reg.folio}</strong> en el concepto del pago
            y envía tu comprobante una vez realizada la transferencia.
          </p>
          {whatsappContact && (
            <p className="text-xs text-muted-foreground">
              WhatsApp de contacto: <strong>{whatsappContact}</strong>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
