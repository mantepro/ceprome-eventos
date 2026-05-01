import { LayoutDashboard, Calendar, CreditCard, Users, ScanLine, Settings, Ticket, UserCog } from 'lucide-react'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import { SidebarLink } from './sidebar-link'

const allNavItems = [
  { href: '/admin',           label: 'Dashboard',     icon: LayoutDashboard, exact: true,  roles: null },
  { href: '/admin/eventos',   label: 'Eventos',       icon: Calendar,        exact: false, roles: null },
  { href: '/admin/inscritos', label: 'Inscritos',     icon: Users,           exact: false, roles: null },
  { href: '/admin/pagos',     label: 'Pagos',         icon: CreditCard,      exact: false, roles: null },
  { href: '/admin/cupones',   label: 'Cupones',       icon: Ticket,          exact: false, roles: null },
  { href: '/admin/usuarios',  label: 'Usuarios',      icon: UserCog,         exact: false, roles: ['super_admin', 'org_admin'] },
  { href: '/admin/acceso',    label: 'Acceso',        icon: ScanLine,        exact: false, roles: null },
  { href: '/admin/configuracion', label: 'Configuración', icon: Settings,    exact: false, roles: null },
]

export async function Sidebar() {
  const profile = await getCurrentUserProfile()
  const role = profile?.role ?? null

  const navItems = allNavItems.filter(
    (item) => item.roles === null || (role !== null && item.roles.includes(role))
  )

  return (
    <aside className="w-56 shrink-0 border-r bg-background flex flex-col">
      <div className="h-14 flex items-center px-5 border-b">
        <span className="font-semibold text-sm tracking-tight">CEPROME Admin</span>
      </div>
      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon, exact }) => (
          <SidebarLink key={href} href={href} label={label} icon={icon} exact={exact} />
        ))}
      </nav>
    </aside>
  )
}
