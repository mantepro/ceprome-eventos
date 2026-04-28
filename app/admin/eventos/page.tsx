import Link from 'next/link'
import { getCurrentUserProfile, getAdminEvents } from '@/lib/queries/admin'
import { formatDateShort } from '@/lib/utils'

export const metadata = { title: 'Eventos — CEPROME Admin' }

const statusLabels: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Borrador',   className: 'bg-gray-100 text-gray-600' },
  published: { label: 'Publicado',  className: 'bg-green-100 text-green-800' },
  closed:    { label: 'Cerrado',    className: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelado',  className: 'bg-red-100 text-red-800' },
}

const modalityLabels: Record<string, string> = {
  presencial: 'Presencial',
  virtual:    'Virtual',
  hibrido:    'Híbrido',
}

export default async function EventosPage() {
  const profile = await getCurrentUserProfile()
  if (!profile) return null

  const events = await getAdminEvents(profile.organization_id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {events.length} evento{events.length !== 1 ? 's' : ''} en tu organización
          </p>
        </div>
        <Link
          href="/admin/eventos/nuevo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nuevo evento
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p className="font-medium">Sin eventos todavía</p>
          <p className="text-sm mt-1">Los eventos aparecerán aquí una vez creados.</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nombre</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Lugar</th>
                <th className="px-4 py-3 text-left font-medium">Modalidad</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((ev) => {
                const s = statusLabels[ev.status] ?? { label: ev.status, className: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{ev.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateShort(ev.starts_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ev.location ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {modalityLabels[ev.modality] ?? ev.modality}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/eventos/${ev.id}/editar`}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Editar
                        </Link>
                        <Link
                          href={`/admin/inscritos?evento=${ev.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Inscritos
                        </Link>
                      </div>
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
