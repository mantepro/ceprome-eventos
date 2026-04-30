import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUserProfile, getRegistrationById } from '@/lib/queries/admin'
import { PaymentActions } from '@/components/admin/payment-actions'
import { ResendTicketButton } from '@/components/admin/resend-ticket-button'
import { formatCurrency, formatDateShort } from '@/lib/utils'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  return { title: `Inscripción ${id.slice(0, 8)}… — CEPROME Admin` }
}

const statusLabels: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente de pago', className: 'bg-amber-100 text-amber-800' },
  paid:      { label: 'Pagado',            className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado',         className: 'bg-red-100 text-red-800' },
  draft:     { label: 'Borrador',          className: 'bg-gray-100 text-gray-600' },
}

const ticketStatusLabels: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente', className: 'bg-amber-100 text-amber-800' },
  active:    { label: 'Activo',    className: 'bg-green-100 text-green-800' },
  used:      { label: 'Usado',     className: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelado', className: 'bg-red-100 text-red-800' },
}

const paymentStatusLabels: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-800' },
  completed: { label: 'Completado', className: 'bg-green-100 text-green-800' },
  failed:    { label: 'Rechazado',  className: 'bg-red-100 text-red-800' },
  refunded:  { label: 'Reembolsado',className: 'bg-gray-100 text-gray-600' },
}

export default async function InscritoDetailPage({ params }: { params: Params }) {
  const { id } = await params

  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const reg = await getRegistrationById(id, profile.organization_id)
  if (!reg) notFound()

  const attendee = (reg.attendees as {
    id: string; first_name: string; last_name: string; email: string; phone: string | null
  }[])?.[0]

  const ticket = (reg.tickets as {
    id: string; status: string; qr_url: string | null; checked_in_at: string | null; created_at: string
    ticket_types: { name: string; price: number; currency: string } | null
  }[])?.[0]

  const payment = (reg.payments as {
    id: string; method: string; status: string; amount: number; currency: string
    external_ref: string | null; verified_at: string | null; created_at: string
  }[])?.[0]

  const event = reg.events as { id: string; name: string; starts_at: string; location: string | null } | null
  const regStatus = statusLabels[reg.status] ?? { label: reg.status, className: 'bg-gray-100 text-gray-600' }
  const pendingPayment = payment?.status === 'pending' && reg.payment_method === 'manual'

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/inscritos"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{reg.folio}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Detalle de inscripción</p>
        </div>
        <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${regStatus.className}`}>
          {regStatus.label}
        </span>
      </div>

      {pendingPayment && payment && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-semibold text-amber-900 text-sm mb-3">
            Pago manual pendiente de validación
          </p>
          <PaymentActions paymentId={payment.id} />
        </div>
      )}

      {reg.status === 'paid' && (
        <div className="rounded-lg border px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Correo de confirmación</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Reenvía el correo con ticket QR y PDF comprobante al asistente.
            </p>
          </div>
          <ResendTicketButton registrationId={reg.id} />
        </div>
      )}

      <Section title="Evento">
        {event ? (
          <FieldGroup>
            <Field label="Nombre" value={event.name} />
            <Field label="Fecha" value={formatDateShort(event.starts_at)} />
            {event.location && <Field label="Lugar" value={event.location} />}
          </FieldGroup>
        ) : (
          <p className="text-muted-foreground text-sm">Sin evento asociado</p>
        )}
      </Section>

      <Section title="Asistente">
        {attendee ? (
          <FieldGroup>
            <Field label="Nombre" value={`${attendee.first_name} ${attendee.last_name}`} />
            <Field label="Email" value={attendee.email} />
            {attendee.phone && <Field label="Teléfono" value={attendee.phone} />}
          </FieldGroup>
        ) : (
          <p className="text-muted-foreground text-sm">Sin datos de asistente</p>
        )}
      </Section>

      <Section title="Ticket">
        {ticket ? (
          <FieldGroup>
            <Field label="Tipo" value={ticket.ticket_types?.name ?? '—'} />
            <Field
              label="Precio"
              value={formatCurrency(ticket.ticket_types?.price ?? 0, ticket.ticket_types?.currency ?? 'USD')}
            />
            <Field
              label="Estado"
              value={
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  ticketStatusLabels[ticket.status]?.className ?? 'bg-gray-100'
                }`}>
                  {ticketStatusLabels[ticket.status]?.label ?? ticket.status}
                </span>
              }
            />
            {ticket.checked_in_at && (
              <Field label="Check-in" value={formatDateShort(ticket.checked_in_at)} />
            )}
          </FieldGroup>
        ) : (
          <p className="text-muted-foreground text-sm">Sin ticket generado</p>
        )}
      </Section>

      <Section title="Pago">
        {payment ? (
          <FieldGroup>
            <Field
              label="Método"
              value={payment.method === 'manual' ? 'Transferencia / Depósito' : 'PayPal'}
            />
            <Field label="Monto" value={formatCurrency(payment.amount, payment.currency)} />
            <Field
              label="Estado"
              value={
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  paymentStatusLabels[payment.status]?.className ?? 'bg-gray-100'
                }`}>
                  {paymentStatusLabels[payment.status]?.label ?? payment.status}
                </span>
              }
            />
            {payment.external_ref && (
              <Field label="Referencia" value={payment.external_ref} />
            )}
            {payment.verified_at && (
              <Field label="Validado" value={formatDateShort(payment.verified_at)} />
            )}
            <Field label="Registrado" value={formatDateShort(payment.created_at)} />
          </FieldGroup>
        ) : (
          <p className="text-muted-foreground text-sm">Sin registro de pago</p>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
