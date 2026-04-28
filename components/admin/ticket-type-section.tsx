'use client'

import { useState, useActionState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTicketType, updateTicketType, toggleTicketTypeActive } from '@/lib/actions/events'
import { formatCurrency } from '@/lib/utils'
import type { TicketTypeRow } from '@/lib/queries/admin'

type Props = {
  eventId: string
  ticketTypes: TicketTypeRow[]
}

export function TicketTypeSection({ eventId, ticketTypes }: Props) {
  const boundCreate = createTicketType.bind(null, eventId)
  const [state, formAction, pending] = useActionState(boundCreate, {})

  return (
    <div className="space-y-4">
      {ticketTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Sin tipos de acceso. Agrega al menos uno para que el evento acepte inscripciones.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 text-left font-medium">Nombre</th>
              <th className="pb-2 text-right font-medium">Precio</th>
              <th className="pb-2 text-right font-medium">Cupo</th>
              <th className="pb-2 text-right font-medium">Vendidos</th>
              <th className="pb-2 text-right font-medium">Estado</th>
              <th className="pb-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {ticketTypes.map((tt) => (
              <TicketTypeRowItem key={tt.id} ticketType={tt} eventId={eventId} />
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t pt-4">
        <p className="text-sm font-semibold mb-3">Agregar tipo de acceso</p>
        <form action={formAction} className="space-y-3">
          {state.error && (
            <p className="text-xs text-destructive">{state.error}</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input name="name" placeholder="Local, Extranjero, VIP…" required />
              {state.errors?.name && (
                <p className="text-xs text-destructive">{state.errors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Precio *</Label>
              <Input name="price" type="number" min="0" step="0.01" placeholder="100" required />
              {state.errors?.price && (
                <p className="text-xs text-destructive">{state.errors.price}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Moneda</Label>
              <Input name="currency" defaultValue="USD" placeholder="USD" maxLength={3} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Cupo (vacío = ilimitado)</Label>
              <Input name="capacity" type="number" min="1" placeholder="500" className="w-32" />
            </div>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Agregando…' : 'Agregar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TicketTypeRowItem({
  ticketType,
  eventId,
}: {
  ticketType: TicketTypeRow
  eventId: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [togglePending, startToggleTransition] = useTransition()

  const boundUpdate = updateTicketType.bind(null, ticketType.id, eventId)
  const [editState, editFormAction, editPending] = useActionState(
    async (prev: { error?: string; errors?: Record<string, string> }, formData: FormData) => {
      const result = await boundUpdate(prev, formData)
      if (!result.error && !result.errors) setIsEditing(false)
      return result
    },
    {}
  )

  function handleToggle() {
    startToggleTransition(async () => {
      await toggleTicketTypeActive(ticketType.id, ticketType.active, eventId)
    })
  }

  return (
    <>
      <tr className="border-t">
        <td className="py-2 font-medium">{ticketType.name}</td>
        <td className="py-2 text-right">{formatCurrency(ticketType.price, ticketType.currency)}</td>
        <td className="py-2 text-right text-muted-foreground">{ticketType.capacity ?? '∞'}</td>
        <td className="py-2 text-right text-muted-foreground">{ticketType.sold_count}</td>
        <td className="py-2 text-right">
          <button
            onClick={handleToggle}
            disabled={togglePending}
            className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
              ticketType.active
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {togglePending ? '…' : ticketType.active ? 'Activo' : 'Inactivo'}
          </button>
        </td>
        <td className="py-2 text-right">
          <button
            onClick={() => setIsEditing((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
        </td>
      </tr>

      {isEditing && (
        <tr>
          <td colSpan={6} className="pb-3 pt-1">
            <form action={editFormAction} className="bg-muted/40 rounded-lg p-4 space-y-3">
              {editState.error && (
                <p className="text-xs text-destructive">{editState.error}</p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs">Nombre *</Label>
                  <Input
                    name="name"
                    defaultValue={ticketType.name}
                    required
                  />
                  {editState.errors?.name && (
                    <p className="text-xs text-destructive">{editState.errors.name}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Precio *</Label>
                  <Input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={ticketType.price}
                    required
                  />
                  {editState.errors?.price && (
                    <p className="text-xs text-destructive">{editState.errors.price}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Input
                    name="currency"
                    defaultValue={ticketType.currency}
                    maxLength={3}
                  />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Cupo (vacío = ilimitado)</Label>
                  <Input
                    name="capacity"
                    type="number"
                    min="1"
                    defaultValue={ticketType.capacity ?? ''}
                    placeholder="∞"
                    className="w-32"
                  />
                </div>
                <Button type="submit" size="sm" disabled={editPending}>
                  {editPending ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </form>
          </td>
        </tr>
      )}
    </>
  )
}
