'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { confirmManualPaymentIntent } from '@/lib/actions/registration'

export function ConfirmTransferButton({
  folio,
  alreadyConfirmed = false,
}: {
  folio: string
  alreadyConfirmed?: boolean
}) {
  const [done, setDone] = useState(alreadyConfirmed)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  if (done) {
    return (
      <p className="text-sm text-green-700 text-center">
        Quedaste en proceso de validación. Realiza tu depósito con los datos de arriba — en cuanto confirmemos tu pago, te llegará el correo con tu QR.
      </p>
    )
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        className="w-full"
        disabled={isPending}
        onClick={() => startTransition(async () => {
          const result = await confirmManualPaymentIntent(folio)
          if (result?.error) setError(result.error)
          else setDone(true)
        })}
      >
        {isPending ? 'Guardando…' : 'Elegir transferencia bancaria'}
      </Button>
      {error && <p className="text-sm text-destructive text-center">{error}</p>}
    </div>
  )
}
