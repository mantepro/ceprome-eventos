'use client'

import Image from 'next/image'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { EventFormState } from '@/lib/actions/events'
import type { AdminEventDetail } from '@/lib/queries/admin'

type Props = {
  action: (prev: EventFormState, formData: FormData) => Promise<EventFormState>
  defaultValues?: AdminEventDetail
  submitLabel?: string
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export function EventForm({ action, defaultValues, submitLabel = 'Guardar' }: Props) {
  const [state, formAction, pending] = useActionState(action, {})

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Cambios guardados correctamente.
        </div>
      )}

      <Field label="Nombre del evento *" error={state.errors?.name}>
        <Input
          name="name"
          defaultValue={defaultValues?.name ?? ''}
          placeholder="VI Congreso Latinoamericano CEPROME"
          required
        />
      </Field>

      <Field label="Descripción" error={state.errors?.description}>
        <Textarea
          name="description"
          defaultValue={defaultValues?.description ?? ''}
          placeholder="Descripción del evento…"
          rows={3}
        />
      </Field>

      <Field label="Lugar" error={state.errors?.location}>
        <Input
          name="location"
          defaultValue={defaultValues?.location ?? ''}
          placeholder="Ciudad de México, México"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Inicio *" error={state.errors?.starts_at}>
          <Input
            name="starts_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(defaultValues?.starts_at)}
            required
          />
        </Field>
        <Field label="Fin (opcional)" error={state.errors?.ends_at}>
          <Input
            name="ends_at"
            type="datetime-local"
            defaultValue={toDatetimeLocal(defaultValues?.ends_at)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Modalidad *" error={state.errors?.modality}>
          <SelectField
            name="modality"
            defaultValue={defaultValues?.modality ?? 'presencial'}
            options={[
              { value: 'presencial', label: 'Presencial' },
              { value: 'virtual',    label: 'Virtual' },
              { value: 'hibrido',    label: 'Híbrido' },
            ]}
          />
        </Field>
        <Field label="Estado *" error={state.errors?.status}>
          <SelectField
            name="status"
            defaultValue={defaultValues?.status ?? 'draft'}
            options={[
              { value: 'draft',      label: 'Borrador' },
              { value: 'published',  label: 'Publicado' },
              { value: 'closed',     label: 'Cerrado' },
              { value: 'cancelled',  label: 'Cancelado' },
            ]}
          />
        </Field>
      </div>

      <Field label="Imagen de portada">
        {defaultValues?.cover_url && (
          <div className="mb-2">
            <Image
              src={defaultValues.cover_url}
              alt="Portada actual"
              width={480}
              height={270}
              className="rounded-lg object-cover border w-full max-w-sm aspect-video"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Imagen actual — sube una nueva para reemplazar
            </p>
          </div>
        )}
        <Input
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="cursor-pointer"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SelectField({
  name,
  defaultValue,
  options,
}: {
  name: string
  defaultValue: string
  options: { value: string; label: string }[]
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
