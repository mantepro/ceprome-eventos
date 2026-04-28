'use client'

import { useState, useTransition, useActionState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
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
import {
  createEventField,
  updateEventField,
  deleteEventField,
  reorderEventFields,
} from '@/lib/actions/event-fields'
import type { AdminEventField } from '@/lib/queries/admin'

type FieldType = 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | 'date'

const TYPE_LABELS: Record<FieldType, string> = {
  text:     'Texto corto',
  textarea: 'Texto largo',
  number:   'Número',
  select:   'Selección (dropdown)',
  radio:    'Opción única (radio)',
  checkbox: 'Casilla (sí/no)',
  date:     'Fecha',
}

const TYPES_WITH_OPTIONS: FieldType[] = ['select', 'radio']

const SCOPE_LABELS = {
  participant: 'Formulario público',
  internal: 'Uso interno (solo admin)',
}

const BASE_FIELDS = ['Nombre', 'Apellido', 'Correo electrónico', 'Teléfono (opcional)']

type Props = {
  eventId: string
  fields: AdminEventField[]
}

export function EventFieldsSection({ eventId, fields }: Props) {
  const [localFields, setLocalFields] = useState(fields)
  const [reorderPending, startReorder] = useTransition()

  const sensors = useSensors(useSensor(PointerSensor))

  const boundCreate = createEventField.bind(null, eventId)
  const [createState, createFormAction, createPending] = useActionState(boundCreate, {})
  const [newType, setNewType] = useState<FieldType>('text')
  const [newScope, setNewScope] = useState<'participant' | 'internal'>('participant')

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localFields.findIndex((f) => f.id === active.id)
    const newIndex = localFields.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(localFields, oldIndex, newIndex)
    setLocalFields(reordered)

    startReorder(async () => {
      await reorderEventFields(eventId, reordered.map((f) => f.id))
    })
  }

  return (
    <div className="space-y-4">
      {/* Base fields — read-only */}
      <table className="w-full text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="pb-2 w-6"></th>
            <th className="pb-2 text-left font-medium">Etiqueta</th>
            <th className="pb-2 text-left font-medium">Tipo</th>
            <th className="pb-2 text-center font-medium">Obligatorio</th>
            <th className="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          {BASE_FIELDS.map((label) => (
            <tr key={label} className="border-t">
              <td className="py-2 text-muted-foreground/30">
                <GripVertical className="h-4 w-4" />
              </td>
              <td className="py-2 text-muted-foreground">{label}</td>
              <td className="py-2 text-muted-foreground">Texto corto</td>
              <td className="py-2 text-center text-muted-foreground">✓</td>
              <td className="py-2 text-right">
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Campo base
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Custom fields — draggable */}
      {localFields.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={localFields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <table className="w-full text-sm">
              <tbody>
                {localFields.map((f) => (
                  <SortableFieldRow
                    key={f.id}
                    field={f}
                    eventId={eventId}
                    onDelete={(id) =>
                      setLocalFields((prev) => prev.filter((x) => x.id !== id))
                    }
                  />
                ))}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      )}

      {reorderPending && (
        <p className="text-xs text-muted-foreground">Guardando orden…</p>
      )}

      {localFields.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Sin campos personalizados aún.
        </p>
      )}

      {/* Add field form */}
      <div className="border-t pt-4">
        <p className="text-sm font-semibold mb-3">Agregar campo personalizado</p>
        <form action={createFormAction} className="space-y-3">
          {createState.error && (
            <p className="text-xs text-destructive">{createState.error}</p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1 space-y-1">
              <Label className="text-xs">Etiqueta *</Label>
              <Input name="label" placeholder="País, Diócesis, Organización…" required />
              {createState.errors?.label && (
                <p className="text-xs text-destructive">{createState.errors.label}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo *</Label>
              <Select
                name="field_type"
                value={newType}
                onValueChange={(v) => setNewType(v as FieldType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TYPE_LABELS) as [FieldType, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Orden</Label>
              <Input
                name="sort_order"
                type="number"
                min="0"
                defaultValue={localFields.length * 10}
                className="w-20"
              />
            </div>
          </div>

          {TYPES_WITH_OPTIONS.includes(newType) && (
            <div className="space-y-1">
              <Label className="text-xs">Opciones (separadas por coma) *</Label>
              <Input name="options" placeholder="México, Colombia, Argentina, España" />
              {createState.errors?.options && (
                <p className="text-xs text-destructive">{createState.errors.options}</p>
              )}
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Alcance *</Label>
            <Select
              name="scope"
              value={newScope}
              onValueChange={(v) => setNewScope(v as 'participant' | 'internal')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="participant">{SCOPE_LABELS.participant}</SelectItem>
                <SelectItem value="internal">{SCOPE_LABELS.internal}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="required" className="h-4 w-4 rounded" />
              Obligatorio
            </label>
            <Button type="submit" size="sm" disabled={createPending}>
              {createPending ? 'Agregando…' : 'Agregar campo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SortableFieldRow({
  field,
  eventId,
  onDelete,
}: {
  field: AdminEventField
  eventId: string
  onDelete: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [isEditing, setIsEditing] = useState(false)
  const [editType, setEditType] = useState<FieldType>(field.field_type as FieldType)
  const [editScope, setEditScope] = useState<'participant' | 'internal'>(field.scope as 'participant' | 'internal')
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
      onDelete(field.id)
    })
  }

  return (
    <>
      <tr ref={setNodeRef} style={style} className="border-t">
        <td className="py-2 w-6 cursor-grab text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </td>
        <td className="py-2 font-medium">
          {field.label}
          {field.scope === 'internal' && (
            <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Interno</span>
          )}
        </td>
        <td className="py-2 text-muted-foreground">{TYPE_LABELS[field.field_type as FieldType]}</td>
        <td className="py-2 text-center">{field.required ? '✓' : '—'}</td>
        <td className="py-2 text-right">
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => { setIsEditing((v) => !v); setEditType(field.field_type as FieldType); setEditScope(field.scope as 'participant' | 'internal') }}
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
          </div>
        </td>
      </tr>

      {isEditing && (
        <tr>
          <td />
          <td colSpan={4} className="pb-3 pt-1">
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
                  <Select
                    name="field_type"
                    value={editType}
                    onValueChange={(v) => setEditType(v as FieldType)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(TYPE_LABELS) as [FieldType, string][]).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
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

              {TYPES_WITH_OPTIONS.includes(editType) && (
                <div className="space-y-1">
                  <Label className="text-xs">Opciones (separadas por coma)</Label>
                  <Input
                    name="options"
                    defaultValue={field.options?.join(', ') ?? ''}
                    placeholder="México, Colombia, Argentina"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Alcance</Label>
                <Select
                  name="scope"
                  value={editScope}
                  onValueChange={(v) => setEditScope(v as 'participant' | 'internal')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">{SCOPE_LABELS.participant}</SelectItem>
                    <SelectItem value="internal">{SCOPE_LABELS.internal}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

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
