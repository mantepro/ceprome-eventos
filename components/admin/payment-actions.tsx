'use client'

import { useTransition } from 'react'
import { validatePayment, rejectPayment, confirmPayment } from '@/lib/actions/payments'
import { updateRegistrationStatus } from '@/lib/actions/registrations'
import { Button } from '@/components/ui/button'

export function PaymentActions({ paymentId }: { paymentId: string }) {
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
      <Button size="sm" onClick={handleValidate} disabled={validating || rejecting}>
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

export function PreregActions({ registrationId }: { registrationId: string }) {
  const [confirming, startConfirm] = useTransition()
  const [cancelling, startCancel] = useTransition()

  function handleConfirm() {
    startConfirm(async () => {
      const result = await confirmPayment(registrationId)
      if (result.error) alert(result.error)
    })
  }

  function handleCancel() {
    if (!confirm('¿Cancelar esta pre-inscripción? El lugar reservado quedará liberado.')) return
    startCancel(async () => {
      const result = await updateRegistrationStatus(registrationId, 'cancelled')
      if (result.error) alert(result.error)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" onClick={handleConfirm} disabled={confirming || cancelling}>
        {confirming ? 'Confirmando…' : 'Validar pago'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleCancel}
        disabled={confirming || cancelling}
        className="text-destructive hover:text-destructive"
      >
        {cancelling ? 'Cancelando…' : 'Cancelar'}
      </Button>
    </div>
  )
}
