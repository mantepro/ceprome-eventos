import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getPendingPayments, getPendingPreregs } from '@/lib/queries/admin'
import { PaymentActions, PreregActions } from '@/components/admin/payment-actions'
import { formatCurrency, formatDateShort } from '@/lib/utils'

export const metadata = { title: 'Pagos pendientes — CEPROME Admin' }

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

export default async function PagosPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null
  if (profile.hide_financials) redirect('/admin')

  const [payments, preregs] = await Promise.all([
    getPendingPayments(profile.organization_id),
    getPendingPreregs(profile.organization_id),
  ])

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagos pendientes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Validación de transferencias, depósitos y pre-registros
        </p>
      </div>

      {/* ── Pagos manuales ── */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Pagos manuales</h2>
        {payments.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p className="font-medium">Sin pagos manuales pendientes</p>
            <p className="text-sm mt-1">Todos los pagos han sido procesados.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Folio</th>
                  <th className="px-4 py-3 text-left font-medium">Asistente</th>
                  <th className="px-4 py-3 text-left font-medium">Evento</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((p) => {
                  const reg = p.registrations as {
                    id: string
                    folio: string
                    status: string
                    events: { name: string } | null
                    attendees: { first_name: string; last_name: string; email: string }[]
                  }
                  const attendee = reg.attendees?.[0]

                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-sm">{reg.folio}</td>
                      <td className="px-4 py-3">
                        {attendee ? (
                          <div>
                            <p className="font-medium">
                              {attendee.first_name} {attendee.last_name}
                            </p>
                            <p className="text-muted-foreground text-xs">{attendee.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {reg.events?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateShort(p.created_at)}
                        {daysSince(p.created_at) >= 3 && (
                          <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            hace {daysSince(p.created_at)} días
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PaymentActions paymentId={p.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Pre-registros ── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Registros pendientes de pago</h2>
          <p className="text-sm text-muted-foreground">
            Asistentes que reservaron lugar (con o sin transferencia iniciada) y aún no han completado el pago.
          </p>
        </div>
        {preregs.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p className="font-medium">Sin pre-registros pendientes</p>
            <p className="text-sm mt-1">No hay reservas de lugar por completar.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Folio</th>
                  <th className="px-4 py-3 text-left font-medium">Asistente</th>
                  <th className="px-4 py-3 text-left font-medium">Evento</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo de acceso</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preregs.map((reg) => {
                  const attendee = (reg.attendees as {
                    first_name: string; last_name: string; email: string
                  }[])?.[0]
                  const ticketType = (reg.tickets as {
                    ticket_types: { name: string; currency: string } | null
                  }[])?.[0]?.ticket_types
                  const eventName = (reg.events as { name: string } | null)?.name

                  return (
                    <tr key={reg.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-sm">{reg.folio}</td>
                      <td className="px-4 py-3">
                        {attendee ? (
                          <div>
                            <p className="font-medium">
                              {attendee.first_name} {attendee.last_name}
                            </p>
                            <p className="text-muted-foreground text-xs">{attendee.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{eventName ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{ticketType?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(reg.total_amount, ticketType?.currency ?? 'USD')}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateShort(reg.created_at)}
                        {daysSince(reg.created_at) >= 3 && (
                          <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            hace {daysSince(reg.created_at)} días
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PreregActions registrationId={reg.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
