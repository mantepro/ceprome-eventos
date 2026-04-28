import { Users, Clock, CheckCircle, DollarSign } from 'lucide-react'
import { getCurrentUserProfile, getAdminStats } from '@/lib/queries/admin'
import { formatCurrency } from '@/lib/utils'

export const metadata = { title: 'Dashboard — CEPROME Admin' }

export default async function AdminDashboard() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const stats = await getAdminStats(profile.organization_id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          VI Congreso Latinoamericano CEPROME · 2–4 marzo 2027
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      </div>
    </div>
  )
}

type Color = 'blue' | 'amber' | 'green' | 'purple'

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
