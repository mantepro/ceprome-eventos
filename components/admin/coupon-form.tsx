'use client'

import { useActionState, useState } from 'react'
import { createCoupon, type CouponFormState } from '@/lib/actions/coupons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { AdminEvent } from '@/lib/queries/admin'

const initial: CouponFormState = {}

export function CouponForm({ events }: { events: AdminEvent[] }) {
  const [state, formAction, pending] = useActionState(createCoupon, initial)
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          Cupón creado correctamente.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="Código *" error={state.errors?.code}>
          <Input
            name="code"
            placeholder="EARLY2027"
            className="uppercase font-mono"
            style={{ textTransform: 'uppercase' }}
            maxLength={32}
          />
        </Field>

        <Field label="Tipo *" error={state.errors?.type}>
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Valor *" error={state.errors?.value}>
          <Input name="value" type="number" min="0.01" step="0.01" placeholder="10" />
        </Field>

        {type === 'fixed' ? (
          <Field label="Moneda (vacío = aplica a cualquiera)" error={state.errors?.currency}>
            <Input name="currency" className="uppercase" placeholder="USD" maxLength={3} />
          </Field>
        ) : (
          <input type="hidden" name="currency" value="" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Límite de usos (vacío = ilimitado)" error={state.errors?.max_uses}>
          <Input name="max_uses" type="number" min="1" step="1" placeholder="Sin límite" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Aprobado por" error={state.errors?.approved_by}>
          <Input name="approved_by" placeholder="Nombre de quien autorizó" />
        </Field>

        <Field label="Motivo / descripción" error={state.errors?.description}>
          <Textarea
            name="description"
            placeholder="Beca por ponencia internacional, cortesía institucional, etc."
            rows={2}
          />
        </Field>
      </div>

      <Field label="Evento (vacío = aplica a todos)" error={state.errors?.event_id}>
        <select
          name="event_id"
          defaultValue=""
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Global — aplica a cualquier evento</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </Field>

      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="count_as_scholarship"
            defaultChecked
            className="h-4 w-4 rounded"
          />
          Contabilizar como beca otorgada en reportes
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          Si lo desmarcas, el descuento de este cupón no aparecerá en el reporte de becas otorgadas — útil para cupones de prueba o internos que no quieres que aparezcan en reportes económicos.
        </p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? 'Creando…' : 'Crear cupón'}
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
