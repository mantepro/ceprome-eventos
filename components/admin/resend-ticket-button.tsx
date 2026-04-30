'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { generateAndSendTicket } from '@/lib/actions/generate-ticket'

export function ResendTicketButton({ registrationId }: { registrationId: string }) {
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    setError('')
    setDone(false)
    startTransition(async () => {
      try {
        await generateAndSendTicket(registrationId)
        setDone(true)
      } catch {
        setError('No se pudo reenviar el correo. Intenta de nuevo.')
      }
    })
  }

  return (
    <div className="space-y-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? 'Enviando…' : 'Reenviar confirmación'}
      </Button>
      {done && (
        <p className="text-xs text-green-700">Correo con QR reenviado correctamente.</p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
