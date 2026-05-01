'use client'

import { useState, useTransition } from 'react'
import { inviteUser } from '@/lib/actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  callerRole: 'super_admin' | 'org_admin'
}

export function UserInviteModal({ callerRole }: Props) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [pending, start] = useTransition()

  function handleOpenChange(v: boolean) {
    if (pending) return
    setOpen(v)
    if (!v) { setError(''); setSuccess(false) }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const role = fd.get('role') as 'org_admin' | 'event_staff'
    start(async () => {
      const result = await inviteUser(email, role)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => handleOpenChange(false), 1500)
      }
    })
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Invitar usuario</Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invitar usuario</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Se enviará un correo con enlace para crear contraseña.
            </p>
          </DialogHeader>

          {success ? (
            <div className="py-6 text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl mb-3">✓</div>
              <p className="font-medium">Invitación enviada</p>
              <p className="text-sm text-muted-foreground mt-1">El usuario recibirá un correo para activar su cuenta.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Correo electrónico</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  required
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Rol</Label>
                <select
                  id="invite-role"
                  name="role"
                  defaultValue="event_staff"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {callerRole === 'super_admin' && (
                    <option value="org_admin">Administrador (org_admin)</option>
                  )}
                  <option value="event_staff">Personal de evento (event_staff)</option>
                </select>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenChange(false)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  {pending ? 'Enviando…' : 'Enviar invitación'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
