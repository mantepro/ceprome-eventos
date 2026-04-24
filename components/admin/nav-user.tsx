import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/auth/login/actions'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { LogOut } from 'lucide-react'
import type { User } from '@/types/database'

const roleLabel: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Administrador',
  event_staff: 'Staff',
}

export async function NavUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? (await supabase
        .from('users')
        .select('first_name, last_name, role')
        .eq('id', user.id)
        .single()) as { data: Pick<User, 'first_name' | 'last_name' | 'role'> | null; error: unknown }
    : { data: null }

  const initials = profile
    ? `${profile.first_name?.[0] ?? ''}${profile.last_name?.[0] ?? ''}`.toUpperCase() || '??'
    : '??'

  const displayName = profile?.first_name
    ? `${profile.first_name} ${profile.last_name ?? ''}`.trim()
    : (user?.email ?? '')

  return (
    <div className="flex items-center gap-3">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="hidden md:block leading-tight">
        <p className="text-sm font-medium">{displayName}</p>
        <p className="text-xs text-muted-foreground">
          {profile?.role ? roleLabel[profile.role] : ''}
        </p>
      </div>
      <form action={signOut}>
        <Button variant="ghost" size="icon" type="submit" title="Cerrar sesión">
          <LogOut className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
