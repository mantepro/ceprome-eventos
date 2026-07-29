'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { verifyInviteOtp, completeProfile } from '@/lib/actions/auth'

type Stage = 'verifying' | 'set-password' | 'saving' | 'error' | 'invalid'

interface Props {
  tokenHash: string
  type: string
}

export function ConfirmInvitePage({ tokenHash, type }: Props) {
  const [stage, setStage] = useState<Stage>('verifying')
  const [authError, setAuthError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [formError, setFormError] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (!tokenHash || !type) {
      setStage('invalid')
      return
    }
    verifyInviteOtp(tokenHash, type).then(({ error }) => {
      if (error) {
        setAuthError(error)
        setStage('error')
      } else {
        setStage('set-password')
      }
    })
  }, [tokenHash, type])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError('')

    if (password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirm) {
      setFormError('Las contraseñas no coinciden.')
      return
    }

    setStage('saving')
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFormError(error.message)
      setStage('set-password')
      return
    }
    try {
      await completeProfile(firstName, lastName)
    } catch {
      // no bloquea el acceso — la contraseña ya se guardó
    }
    router.replace('/admin')
  }

  if (stage === 'verifying') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground animate-pulse">Verificando invitación…</p>
      </div>
    )
  }

  if (stage === 'error' || stage === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
        <div className="max-w-sm w-full bg-white rounded-xl border shadow-sm p-8 text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 text-3xl">!</div>
          <h1 className="text-xl font-bold">Enlace inválido o expirado</h1>
          <p className="text-sm text-muted-foreground">
            {stage === 'invalid'
              ? 'Este enlace de invitación no es válido.'
              : authError || 'El enlace expiró o ya fue utilizado anteriormente.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Contacta al administrador para que envíe una nueva invitación.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="max-w-sm w-full bg-white rounded-xl border shadow-sm p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Crear contraseña</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Elige una contraseña para activar tu cuenta de acceso al panel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="first-name" className="text-sm font-medium">
                Nombre
              </label>
              <input
                id="first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="last-name" className="text-sm font-medium">
                Apellido
              </label>
              <input
                id="last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Repite la contraseña"
              required
            />
          </div>

          {formError && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <button
            type="submit"
            disabled={stage === 'saving'}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {stage === 'saving' ? 'Activando cuenta…' : 'Activar cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
