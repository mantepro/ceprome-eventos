'use client'

import { useState, useActionState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createEventField, updateEventField, deleteEventField } from '@/lib/actions/event-fields'
import type { AdminEventField } from '@/lib/queries/admin'

const TYPE_LABELS: Record<string, string> = {
  text: 'Texto libre',
  select: 'Selección',
  checkbox: 'Casilla (sí/no)',
}

type Props = {
  eventId: string
  fields: AdminEventField[]
}

export function EventFieldsSection({ eventId, fields }: Props) {
  const boundCreate = createEventField.bind(null, eventId)
  const [state, formAction, pending] = useActionState(boundCreate, {})
  const [newType, setNewType] = useState('text')

  return (
    <div className="space-y-4">
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Sin campos personalizados. Los formularios de inscripción solo mostrarán nombre, apellido, email y teléfono.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="pb-2 text-left font-medium">Etiqueta</th>
              <th className="pb-2 text-left font-medium">Tipo</th>
              <th className="pb-2 text-center font-medium">Obligatorio</th>
              <th className="pb-2 text-right font-medium">Orden</th>
              <th className="pb-2 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <EventFieldRow key={f.id} field={f} eventId={eventId} />
            ))}
          </tbody>
        </table>
      )}

      <div className="border-t pt-4">
        <p className="text-sm font-semibold mb-3">Agregar campo</p>
        <form action={formAction} className="space-y-3">
          {state.error && <p className="text-xs text-destructive">{state.error}</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1 space-y-1">
              <Label className="text-xs">Etiqueta *</Label>
              <Input name="label" placeholder="País, Diócesis, Organización…" required />
              {state.errors?.label && (
                <p className="text-xs text-destructive">{state.errors.label}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select
                name="field_type"
                value={newType}
                onValueChange={setNewType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto libre</SelectItem>
                  <SelectItem value="select">Selección</SelectItem>
                  <SelectItem value="checkbox">Casilla (sí/no)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Orden</Label>
              <Input name="sort_order" type="number" min="0" defaultValue="0" className="w-20" />
            </div>
          </div>
          {newType === 'select' && (
            <div className="space-y-1">
              <Label className="text-xs">Opciones (separadas por coma) *</Label>
              <Input name="options" placeholder="México, Colombia, Argentina, España" />
              {state.errors?.options && (
                <p className="text-xs text-destructive">{state.errors.options}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="required" className="h-4 w-4 rounded" />
              Obligatorio
            </label>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Agregando…' : 'Agregar campo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EventFieldRow({
  field,
  eventId,
}: {
  field: AdminEventField
  eventId: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editType, setEditType] = useState<'text' | 'select' | 'checkbox'>(field.field_type)
  const [deletePending, startDelete] = useTransition()

  const boundUpdate = updateEventField.bind(null, field.id, eventId)
  const [editState, editFormAction, editPending] = useActionState(
    async (prev: { error?: string; errors?: Record<string, string> }, formData: FormData) => {
      const result = await boundUpdate(prev, formData)
      if (!result.error && !result.errors) setIsEditing(false)
      return result
    },
    {}
  )

  function handleDelete() {
    if (!confirm(`¿Eliminar el campo "${field.label}"?`)) return
    startDelete(async () => {
      await deleteEventField(field.id, eventId)
    })
  }

  return (
    <>
      <tr className="border-t">
        <td className="py-2 font-medium">{field.label}</td>
        <td className="py-2 text-muted-foreground">{TYPE_LABELS[field.field_type]}</td>
        <td className="py-2 text-center">{field.required ? '✓' : '—'}</td>
        <td className="py-2 text-right text-muted-foreground">{field.sort_order}</td>
        <td className="py-2 text-right flex gap-3 justify-end">
          <button
            onClick={() => { setIsEditing((v) => !v); setEditType(field.field_type) }}
            className="text-xs text-primary hover:underline"
          >
            {isEditing ? 'Cancelar' : 'Editar'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deletePending}
            className="text-xs text-destructive hover:underline"
          >
            {deletePending ? '…' : 'Eliminar'}
          </button>
        </td>
      </tr>

      {isEditing && (
        <tr>
          <td colSpan={5} className="pb-3 pt-1">
            <form action={editFormAction} className="bg-muted/40 rounded-lg p-4 space-y-3">
              {editState.error && (
                <p className="text-xs text-destructive">{editState.error}</p>
              )}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-1 space-y-1">
                  <Label className="text-xs">Etiqueta *</Label>
                  <Input name="label" defaultValue={field.label} required />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo *</Label>
                  <Select name="field_type" value={editType} onValueChange={(v) => setEditType(v as 'text' | 'select' | 'checkbox')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto libre</SelectItem>
                      <SelectItem value="select">Selección</SelectItem>
                      <SelectItem value="checkbox">Casilla (sí/no)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Orden</Label>
                  <Input
                    name="sort_order"
                    type="number"
                    min="0"
                    defaultValue={field.sort_order}
                    className="w-20"
                  />
                </div>
              </div>
              {editType === 'select' && (
                <div className="space-y-1">
                  <Label className="text-xs">Opciones (separadas por coma)</Label>
                  <Input
                    name="options"
                    defaultValue={field.options?.join(', ') ?? ''}
                    placeholder="México, Colombia, Argentina"
                  />
                </div>
              )}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    name="required"
                    defaultChecked={field.required}
                    className="h-4 w-4 rounded"
                  />
                  Obligatorio
                </label>
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
