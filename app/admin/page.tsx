import Link from 'next/link'
import { Users, Clock, CheckCircle, DollarSign, GraduationCap } from 'lucide-react'
import {
  getCurrentUserProfile,
  getAdminStats,
  getAdminEvents,
  getEventTicketTypes,
  getRegistrations,
} from '@/lib/queries/admin'
import type { AdminEvent } from '@/lib/queries/admin'
import { formatDate, formatDateShort, formatCurrency } from '@/lib/utils'

export const metadata = { title: 'Dashboard — CEPROME Admin' }

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pendiente',   className: 'bg-amber-400 text-amber-950' },
  paid:      { label: 'Pagado',      className: 'bg-green-600 text-white' },
  cancelled: { label: 'Cancelado',   className: 'bg-red-600 text-white' },
  draft:     { label: 'Borrador',    className: 'bg-gray-400 text-white' },
  refunded:  { label: 'Reembolsado', className: 'bg-purple-600 text-white' },
}

function sameDay(aIso: string, bIso: string): boolean {
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'America/Mexico_City' }
  return new Date(aIso).toLocaleDateString('es-MX', opts) === new Date(bIso).toLocaleDateString('es-MX', opts)
}

function pickFeaturedEvent(events: AdminEvent[]): AdminEvent | null {
  if (events.length === 0) return null
  const now = new Date()
  const upcoming = events
    .filter((e) => e.status === 'published' && new Date(e.starts_at) >= now)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
  if (upcoming.length > 0) return upcoming[0]
  // Sin eventos futuros publicados — usar el más reciente (ya viene ordenada por starts_at desc)
  return events[0]
}

export default async function AdminDashboard() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const [stats, events, registrations] = await Promise.all([
    getAdminStats(profile.organization_id),
    getAdminEvents(profile.organization_id),
    getRegistrations(profile.organization_id),
  ])

  const featuredEvent = pickFeaturedEvent(events)
  const ticketTypes = featuredEvent
    ? (await getEventTicketTypes(featuredEvent.id, profile.organization_id)).filter((t) => t.active)
    : []
  const recentRegistrations = registrations.filter((r) => r.status !== 'cancelled' && !r.archived).slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        {featuredEvent && (
          <p className="text-muted-foreground mt-1 text-sm">
            {featuredEvent.name} ·{' '}
            {featuredEvent.ends_at && !sameDay(featuredEvent.starts_at, featuredEvent.ends_at)
              ? `${formatDate(featuredEvent.starts_at)} – ${formatDate(featuredEvent.ends_at)}`
              : formatDate(featuredEvent.starts_at)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Total inscritos"
          value={stats.total.toString()}
          icon={Users}
          color="blue"
        />
        <StatCard
          label="Pendientes de pago"
          value={stats.pending.toString()}
          icon={Clock}
          color="amber"
          href="/admin/pagos"
        />
        <StatCard
          label="Pagos confirmados"
          value={stats.paid.toString()}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          label="Total recaudado"
          value={formatCurrency(stats.revenue, 'USD')}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          label="Becas otorgadas"
          value={formatCurrency(stats.scholarshipsAwarded, 'USD')}
          icon={GraduationCap}
          color="rose"
        />
      </div>

      {stats.scholarshipBreakdown.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-semibold">Desglose de becas otorgadas</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Cupón</th>
                <th className="px-4 py-2 text-left font-medium">Aprobado por</th>
                <th className="px-4 py-2 text-left font-medium">Motivo</th>
                <th className="px-4 py-2 text-right font-medium">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {stats.scholarshipBreakdown.map((b) => (
                <tr key={b.couponCode}>
                  <td className="px-4 py-2 font-mono font-medium">{b.couponCode}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.approvedBy ?? '—'}</td>
                  <td className="px-4 py-2 text-muted-foreground">{b.description ?? '—'}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatCurrency(b.totalAmount, 'USD')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <p className="text-sm font-semibold">Inscritos recientes</p>
          <Link href="/admin/inscritos" className="text-xs text-primary hover:underline">
            Ver todos →
          </Link>
        </div>
        {recentRegistrations.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Sin inscripciones todavía.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Folio</th>
                <th className="px-4 py-2 text-left font-medium">Asistente</th>
                <th className="px-4 py-2 text-left font-medium">Evento</th>
                <th className="px-4 py-2 text-left font-medium">Estado</th>
                <th className="px-4 py-2 text-left font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentRegistrations.map((r) => {
                const attendee = r.attendees[0]
                const eventName = (r.events as { name: string } | null)?.name
                const s = STATUS_LABELS[r.status] ?? { label: r.status, className: 'bg-gray-100 text-gray-800' }
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-mono text-xs">{r.folio}</td>
                    <td className="px-4 py-2">
                      {attendee ? `${attendee.first_name} ${attendee.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{eventName ?? '—'}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDateShort(r.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {featuredEvent && ticketTypes.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="text-sm font-semibold">Boletos por tipo — {featuredEvent.name}</p>
          </div>
          <div className="p-4 space-y-4">
            {ticketTypes.map((t) => {
              const pct = t.capacity !== null
                ? Math.min(100, Math.round((t.sold_count / t.capacity) * 100))
                : null
              return (
                <div key={t.id}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-muted-foreground">
                      {t.capacity !== null
                        ? `${t.sold_count} de ${t.capacity}`
                        : `${t.sold_count} inscritos · Sin límite`}
                    </span>
                  </div>
                  {pct !== null && (
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

type Color = 'blue' | 'amber' | 'green' | 'purple' | 'rose'

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string
  value: string
  icon: React.ElementType
  color: Color
  href?: string
}) {
  const colorMap: Record<Color, { bg: string; icon: string }> = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
    rose:   { bg: 'bg-rose-50',   icon: 'text-rose-600' },
  }
  const c = colorMap[color]

  const inner = (
    <div className="rounded-lg border bg-card p-5 flex items-center gap-4">
      <div className={`rounded-full ${c.bg} p-3`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} className="hover:opacity-80 transition-opacity">
        {inner}
      </a>
    )
  }

  return inner
}
