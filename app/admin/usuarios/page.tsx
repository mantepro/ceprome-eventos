import { redirect } from 'next/navigation'
import { getCurrentUserProfile, getOrgUsers } from '@/lib/queries/admin'
import { UserInviteModal } from '@/components/admin/user-invite-modal'
import { UserToggleActive } from '@/components/admin/user-actions'
import { formatDateShort } from '@/lib/utils'

export const metadata = { title: 'Usuarios — CEPROME Admin' }

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Administrador',
  event_staff: 'Escáner',
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800',
  org_admin:   'bg-blue-100 text-blue-800',
  event_staff: 'bg-gray-100 text-gray-600',
}

const TH = { backgroundColor: '#f9fafb', whiteSpace: 'nowrap' as const }

export default async function UsuariosPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null
  if (profile.role === 'event_staff') redirect('/admin')

  const isSuperAdmin = profile.role === 'super_admin'
  const users = await getOrgUsers(profile.organization_id, isSuperAdmin)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {users.length} usuario{users.length !== 1 ? 's' : ''} en tu organización
          </p>
        </div>
        <UserInviteModal callerRole={profile.role as 'super_admin' | 'org_admin'} />
      </div>

      {users.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="font-medium">Sin usuarios registrados</p>
          <p className="text-sm mt-1">Invita al primer miembro de tu equipo.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 3 }}>
              <tr>
                <th className="px-4 py-3 text-left font-medium" style={TH}>Nombre</th>
                <th className="px-4 py-3 text-left font-medium" style={TH}>Correo</th>
                <th className="px-4 py-3 text-left font-medium" style={TH}>Rol</th>
                {isSuperAdmin && (
                  <th className="px-4 py-3 text-left font-medium" style={TH}>Organización</th>
                )}
                <th className="px-4 py-3 text-left font-medium" style={TH}>Estado</th>
                <th className="px-4 py-3 text-left font-medium" style={TH}>Registrado</th>
                <th className="px-4 py-3" style={TH}></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => {
                const isSelf = u.id === profile.id
                const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || '—'
                return (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      {name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-muted-foreground font-normal">(tú)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {(u.organizations as { name: string } | null)?.name ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${u.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`}>
                        {u.active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {formatDateShort(u.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <UserToggleActive userId={u.id} active={u.active} />
                      )}
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
