'use client'

import { useTransition } from 'react'
import { validatePayment, rejectPayment } from '@/lib/actions/payments'
import { Button } from '@/components/ui/button'

interface Props {
  paymentId: string
}

export function PaymentActions({ paymentId }: Props) {
  const [validating, startValidate] = useTransition()
  const [rejecting, startReject] = useTransition()

  function handleValidate() {
    startValidate(async () => {
      const result = await validatePayment(paymentId)
      if (result.error) alert(result.error)
    })
  }

  function handleReject() {
    if (!confirm('¿Rechazar este pago? La inscripción quedará cancelada.')) return
    startReject(async () => {
      const result = await rejectPayment(paymentId)
      if (result.error) alert(result.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        onClick={handleValidate}
        disabled={validating || rejecting}
      >
        {validating ? 'Validando…' : 'Validar pago'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleReject}
        disabled={validating || rejecting}
        className="text-destructive hover:text-destructive"
      >
        {rejecting ? 'Rechazando…' : 'Rechazar'}
      </Button>
    </div>
  )
}
