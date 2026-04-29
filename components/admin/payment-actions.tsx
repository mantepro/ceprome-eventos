'use client'

import { useState, useTransition } from 'react'
import { validatePayment, rejectPayment, confirmPayment, type PaymentMethod } from '@/lib/actions/payments'
import { updateRegistrationStatus } from '@/lib/actions/registrations'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia bancaria' },
  { value: 'deposito',      label: 'Depósito en efectivo' },
  { value: 'paypal',        label: 'PayPal / Tarjeta' },
  { value: 'taquilla',      label: 'Ventanilla / Taquilla' },
  { value: 'otro',          label: 'Otro' },
] as const

interface ModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (method: string) => void
  isPending: boolean
}

export function PaymentMethodModal({ open, onClose, onConfirm, isPending }: ModalProps) {
  const [selected, setSelected] = useState<string>('transferencia')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Por qué medio pagó?</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5 py-2">
          {PAYMENT_METHOD_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer hover:bg-accent transition-colors"
            >
              <input
                type="radio"
                name="pay-method"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => setSelected(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm font-medium">{opt.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => onConfirm(selected)} disabled={isPending}>
            {isPending ? 'Confirmando…' : 'Confirmar pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function PaymentActions({ paymentId }: { paymentId: string }) {
  const [showModal, setShowModal] = useState(false)
  const [validating, startValidate] = useTransition()
  const [rejecting, startReject] = useTransition()

  function handleConfirm(method: string) {
    setShowModal(false)
    startValidate(async () => {
      const result = await validatePayment(paymentId, method as PaymentMethod)
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
    <>
      <PaymentMethodModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirm}
        isPending={validating}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setShowModal(true)} disabled={validating || rejecting}>
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
    </>
  )
}

export function PreregActions({ registrationId }: { registrationId: string }) {
  const [showModal, setShowModal] = useState(false)
  const [confirming, startConfirm] = useTransition()
  const [cancelling, startCancel] = useTransition()

  function handleConfirm(method: string) {
    setShowModal(false)
    startConfirm(async () => {
      const result = await confirmPayment(registrationId, method as PaymentMethod)
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
    <>
      <PaymentMethodModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirm}
        isPending={confirming}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => setShowModal(true)} disabled={confirming || cancelling}>
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
    </>
  )
}
