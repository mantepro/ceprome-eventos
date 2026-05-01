'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { PayPalScriptProvider, PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js'

interface Props {
  folio: string
  orgSlug: string
  currency: string
  amount: number
}

function PayPalButtonsInner({ folio, orgSlug }: { folio: string; orgSlug: string }) {
  const router = useRouter()
  const [{ isPending }] = usePayPalScriptReducer()
  const [error, setError] = useState('')
  const [cancelled, setCancelled] = useState(false)

  async function createOrder() {
    setError('')
    setCancelled(false)
    const res = await fetch('/api/paypal/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folio, orgSlug }),
    })
    const data = await res.json() as { orderId?: string; error?: string }
    if (!res.ok || !data.orderId) throw new Error(data.error ?? 'Error al iniciar el pago.')
    return data.orderId
  }

  async function onApprove(data: { orderID: string }) {
    const res = await fetch('/api/paypal/capture-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: data.orderID, folio, orgSlug }),
    })
    const result = await res.json() as { success?: boolean; error?: string }
    if (!res.ok || !result.success) {
      setError(result.error ?? 'No se pudo confirmar el pago. Contacta al organizador.')
      return
    }
    router.push(`/${orgSlug}/confirmar/${folio}?pago=ok`)
  }

  function onCancel() {
    setCancelled(true)
  }

  function onError(err: Record<string, unknown>) {
    console.error('[PayPal onError]', err)
    setError('Ocurrió un error con PayPal. Intenta de nuevo o usa transferencia bancaria.')
  }

  return (
    <div className="space-y-3">
      {isPending && (
        <div className="h-11 w-full animate-pulse rounded bg-muted" />
      )}
      <PayPalButtons
        style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 44 }}
        createOrder={createOrder}
        onApprove={onApprove}
        onCancel={onCancel}
        onError={onError}
        forceReRender={[folio]}
      />
      {cancelled && !error && (
        <p className="text-sm text-center text-amber-700">
          Cancelaste el pago. Puedes intentarlo cuando quieras.
        </p>
      )}
      {error && (
        <p className="text-sm text-center text-destructive">{error}</p>
      )}
    </div>
  )
}

export function PayPalSdkButton({ folio, orgSlug, currency, amount }: Props) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? ''

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency,
        intent: 'capture',
        components: 'buttons',
      }}
    >
      <PayPalButtonsInner folio={folio} orgSlug={orgSlug} />
      <p className="text-xs text-center text-muted-foreground">
        Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)}
        {' '}· Pago seguro procesado por PayPal
      </p>
    </PayPalScriptProvider>
  )
}
