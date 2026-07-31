'use client'

import { useActionState } from 'react'
import { updateOrgSettings, type OrgSettingsState } from '@/lib/actions/organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initial: OrgSettingsState = {}

type OrgSettingsFormProps = {
  currentEmail: string | null
  currentPhone: string | null
  currentWhatsapp: string | null
}

export function OrgSettingsForm({ currentEmail, currentPhone, currentWhatsapp }: OrgSettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateOrgSettings, initial)

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

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-semibold">Contacto</h2>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo de contacto</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={currentEmail ?? ''}
              placeholder="contacto@tuorganizacion.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={currentPhone ?? ''}
              placeholder="+52 55 1234 5678"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp_contact">WhatsApp de contacto</Label>
            <Input
              id="whatsapp_contact"
              name="whatsapp_contact"
              defaultValue={currentWhatsapp ?? ''}
              placeholder="+52 55 1234 5678"
            />
            <p className="text-xs text-muted-foreground">
              Se mostrará en el pie de todos los correos de confirmación enviados a los asistentes.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </div>
    </form>
  )
}
