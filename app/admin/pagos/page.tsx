import { getCurrentUserProfile, getPendingPayments } from '@/lib/queries/admin'
import { PaymentActions } from '@/components/admin/payment-actions'
import { formatCurrency, formatDateShort } from '@/lib/utils'

export const metadata = { title: 'Pagos pendientes — CEPROME Admin' }

export default async function PagosPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const payments = await getPendingPayments(profile.organization_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pagos pendientes</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Transferencias y depósitos en espera de validación
        </p>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="font-medium">Sin pagos pendientes</p>
          <p className="text-sm mt-1">Todos los pagos manuales han sido procesados.</p>
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
                    <td className="px-4 py-3 font-mono font-medium">{reg.folio}</td>
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
    </div>
  )
}
