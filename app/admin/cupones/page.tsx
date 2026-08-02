import { getCurrentUserProfile, getCoupons, getAdminEvents } from '@/lib/queries/admin'
import { CouponForm } from '@/components/admin/coupon-form'
import { CouponsTable } from '@/components/admin/coupons-table'

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
          <CouponsTable coupons={coupons} hideFinancials={profile.hide_financials} />
        )}
      </section>
    </div>
  )
}
