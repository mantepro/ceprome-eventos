import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateShort } from '@/lib/utils'
import { signOut } from '@/app/auth/login/actions'

export const metadata = { title: 'Escaneo QR — CEPROME' }

async function getPublishedEvents(orgId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('events')
    .select('id, name, starts_at, location')
    .eq('organization_id', orgId)
    .eq('status', 'published')
    .order('starts_at', { ascending: true })
  return data ?? []
}

export default async function ScanPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) redirect('/auth/login')

  const events = await getPublishedEvents(profile.organization_id)

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b px-5 h-14 flex items-center justify-between">
        <span className="font-semibold text-sm">CEPROME · Escaneo QR</span>
        <form action={signOut}>
          <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cerrar sesión
          </button>
        </form>
      </header>

      <div className="p-6 max-w-md mx-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Selecciona el evento</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Toca el evento que vas a escanear hoy.
          </p>
        </div>

        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <p className="font-medium">Sin eventos activos</p>
            <p className="text-sm mt-1">No hay eventos publicados en este momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((ev) => (
              <Link
                key={ev.id}
                href={`/scan/${ev.id}`}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/40 active:bg-muted/60 transition-colors"
              >
                <div>
                  <p className="font-semibold">{ev.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatDateShort(ev.starts_at)}
                    {ev.location ? ` · ${ev.location}` : ''}
                  </p>
                </div>
                <span className="text-muted-foreground text-lg">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
