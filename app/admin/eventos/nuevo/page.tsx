import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createEvent } from '@/lib/actions/events'
import { EventForm } from '@/components/admin/event-form'

export const metadata = { title: 'Nuevo evento — CEPROME Admin' }

export default function NuevoEventoPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/eventos"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo evento</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Completa los datos y guarda para continuar con los tipos de acceso.
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-6">
        <EventForm action={createEvent} submitLabel="Crear evento" />
      </div>
    </div>
  )
}
