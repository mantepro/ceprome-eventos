import { getCurrentUserProfile, getCoupons, getAdminEvents } from '@/lib/queries/admin'
import { CouponForm } from '@/components/admin/coupon-form'
import { CouponActions } from '@/components/admin/coupon-actions'
import { formatDateShort } from '@/lib/utils'

export const metadata = { title: 'Cupones — CEPROME Admin' }

export default async function CuponesPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const [coupons, events] = await Promise.all([
    getCoupons(profile.organization_id),
    getAdminEvents(profile.organization_id),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cupones de descuento</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Crea y gestiona códigos de descuento para tus eventos.
        </p>
      </div>

      {/* Formulario de creación */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Nuevo cupón</h2>
        <div className="rounded-lg border p-4 max-w-xl">
          <CouponForm events={events} />
        </div>
      </section>

      {/* Tabla de cupones */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Cupones existentes</h2>
        {coupons.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p className="font-medium">Sin cupones creados</p>
            <p className="text-sm mt-1">Crea el primero usando el formulario de arriba.</p>
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Tipo</th>
                  <th className="px-4 py-3 text-right font-medium">Valor</th>
                  <th className="px-4 py-3 text-left font-medium">Evento</th>
                  <th className="px-4 py-3 text-center font-medium">Beca</th>
                  <th className="px-4 py-3 text-left font-medium">Aprobado por</th>
                  <th className="px-4 py-3 text-left font-medium">Motivo</th>
                  <th className="px-4 py-3 text-right font-medium">Usos</th>
                  <th className="px-4 py-3 text-left font-medium">Creado</th>
                  <th className="px-4 py-3 text-right font-medium">Estado / Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {coupons.map((c) => {
                  const eventName = (c.events as { name: string } | null)?.name
                  const usageText =
                    c.max_uses !== null
                      ? `${c.used_count} / ${c.max_uses}`
                      : `${c.used_count} / ∞`
                  const exhausted = c.max_uses !== null && c.used_count >= c.max_uses

                  return (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-sm">{c.code}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.type === 'percentage' ? 'Porcentaje' : 'Monto fijo'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {c.type === 'percentage' ? `${c.value}%` : `$${c.value.toLocaleString()}`}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {eventName ?? <span className="italic">Global</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.count_as_scholarship ? (
                          <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Sí
                          </span>
                        ) : (
                          <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.approved_by ?? <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.description ? (
                          <span
                            className="block max-w-[200px] truncate"
                            title={c.description}
                          >
                            {c.description}
                          </span>
                        ) : (
                          <span className="italic">—</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${exhausted ? 'text-destructive' : ''}`}>
                        {usageText}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateShort(c.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <CouponActions
                          couponId={c.id}
                          active={c.active}
                          usedCount={c.used_count}
                        />
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
