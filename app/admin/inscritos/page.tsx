import Link from 'next/link'
import { getCurrentUserProfile, getRegistrations } from '@/lib/queries/admin'
import { formatCurrency, formatDateShort } from '@/lib/utils'

export const metadata = { title: 'Inscritos — CEPROME Admin' }

const statusLabels: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',  className: 'bg-amber-100 text-amber-800' },
  paid:      { label: 'Pagado',     className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
  draft:     { label: 'Borrador',   className: 'bg-gray-100 text-gray-600' },
}

const methodLabels: Record<string, string> = {
  manual: 'Transferencia',
  online: 'PayPal',
}

export default async function InscritosPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const registrations = await getRegistrations(profile.organization_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inscritos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {registrations.length} inscripcion{registrations.length !== 1 ? 'es' : ''} en total
          </p>
        </div>
      </div>

      {registrations.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="font-medium">Sin inscripciones todavía</p>
          <p className="text-sm mt-1">Las inscripciones aparecerán aquí una vez que los asistentes se registren.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Folio</th>
                <th className="px-4 py-3 text-left font-medium">Asistente</th>
                <th className="px-4 py-3 text-left font-medium">Evento</th>
                <th className="px-4 py-3 text-left font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Monto</th>
                <th className="px-4 py-3 text-left font-medium">Método</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {registrations.map((reg) => {
                const attendee = (reg.attendees as { first_name: string; last_name: string; email: string }[])?.[0]
                const ticketType = (reg.tickets as { ticket_types: { name: string; currency: string } | null }[])?.[0]?.ticket_types
                const s = statusLabels[reg.status] ?? { label: reg.status, className: 'bg-gray-100 text-gray-600' }

                return (
                  <tr key={reg.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/inscritos/${reg.id}`}
                        className="font-mono font-medium hover:underline"
                      >
                        {reg.folio}
                      </Link>
                    </td>
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
                      {(reg.events as { name: string } | null)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ticketType?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(reg.total_amount, ticketType?.currency ?? 'USD')}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {reg.payment_method ? methodLabels[reg.payment_method] ?? reg.payment_method : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateShort(reg.created_at)}
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
