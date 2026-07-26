'use client'

import Image from 'next/image'
import { useState, useActionState } from 'react'
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
  orgSlug?: string
  submitLabel?: string
}

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export function EventForm({ action, defaultValues, orgSlug, submitLabel = 'Guardar' }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const [slug, setSlug] = useState(defaultValues?.slug ?? '')

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

      {defaultValues && (
        <Field label="URL amigable *" error={state.errors?.slug}>
          <Input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="vi-congreso-2027"
            pattern="[a-z0-9-]+"
            required
          />
          <p className="text-xs text-muted-foreground mt-1 break-all">
            registro.cepromelat.com/{orgSlug ?? '{org}'}/eventos/{slug || '{url-amigable}'}
          </p>
        </Field>
      )}

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

      <CoverField currentUrl={defaultValues?.cover_url ?? null} />

      <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
        <input
          type="checkbox"
          id="allow_preregistration"
          name="allow_preregistration"
          defaultChecked={defaultValues?.allow_preregistration ?? false}
          className="h-4 w-4 rounded"
        />
        <div>
          <label htmlFor="allow_preregistration" className="text-sm font-medium cursor-pointer">
            Permitir pre-registro
          </label>
          <p className="text-xs text-muted-foreground">
            Los participantes pueden inscribirse sin pagar y completar el pago después
          </p>
        </div>
      </div>

      <Field label="Instrucciones de transferencia bancaria (opcional)">
        <Textarea
          name="transfer_instructions"
          defaultValue={defaultValues?.transfer_instructions ?? ''}
          placeholder={`Banco: BBVA\nCuenta: 1234 5678 9012\nCLABE: 012 345 678 901 234 56\nBeneficiario: CEPROME A.C.\n\nEnvía tu comprobante a tesoreria@ceprome.org con tu folio.`}
          rows={5}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Se incluirá en el correo de instrucciones de pago a pre-registrados y en la página pública de pago.
        </p>
      </Field>

      <Field label="Instrucciones de factura fiscal (opcional)">
        <Textarea
          name="invoice_instructions"
          defaultValue={defaultValues?.invoice_instructions ?? ''}
          placeholder={`Si el participante solicita factura fiscal, incluir en el correo de confirmación:\n\nEjemplo: Envía tus datos fiscales a economia@ceprome.org indicando tu folio. Tiempo de respuesta: 5 días hábiles.`}
          rows={4}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Se incluirá al pie del comprobante PDF y en el correo de confirmación de todos los participantes.
        </p>
      </Field>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function CoverField({ currentUrl }: { currentUrl: string | null }) {
  const [sizeError, setSizeError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && file.size > 2 * 1024 * 1024) {
      setSizeError('La imagen supera el límite de 2MB.')
      e.target.value = ''
    } else {
      setSizeError(null)
    }
  }

  return (
    <Field label="Imagen de portada">
      {currentUrl && (
        <div className="mb-2">
          <Image
            src={currentUrl}
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
        onChange={handleFileChange}
      />
      {sizeError ? (
        <p className="text-xs text-destructive mt-1">{sizeError}</p>
      ) : (
        <p className="text-xs text-muted-foreground mt-1">
          JPG o PNG · proporción 16:9 · mínimo 1280×720 · máximo 2MB
        </p>
      )}
    </Field>
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
