'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { initiatePayPalPayment } from '@/lib/actions/paypal'

interface Props {
  folio: string
  orgSlug: string
}

export function PayPalButton({ folio, orgSlug }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  function handleClick() {
    setError('')
    startTransition(async () => {
      const result = await initiatePayPalPayment(folio, orgSlug)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={isPending} className="w-full" size="lg">
        {isPending ? 'Redirigiendo a PayPal...' : 'Pagar con PayPal'}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  )
}
