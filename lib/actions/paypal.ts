'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayPalOrder } from '@/lib/paypal'

export async function initiatePayPalPayment(
  folio: string,
  orgSlug: string
): Promise<{ error: string }> {
  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, total_amount, status, payment_method, events(name)')
    .eq('folio', folio)
    .single()

  if (!reg) return { error: 'Inscripción no encontrada.' }
  if (reg.status !== 'pending') return { error: 'Esta inscripción ya fue procesada.' }
  if (reg.payment_method !== 'online') return { error: 'Método de pago inválido.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const eventName =
    (reg.events as { name: string } | null)?.name ?? 'Evento CEPROME'

  const { orderId, approvalUrl } = await createPayPalOrder({
    amount: reg.total_amount,
    currency: 'USD',
    description: eventName,
    returnUrl: `${appUrl}/api/paypal/capture?folio=${folio}&slug=${orgSlug}`,
    cancelUrl: `${appUrl}/${orgSlug}/confirmar/${folio}?pago=cancelado`,
  })

  await supabase
    .from('payments')
    .update({ external_ref: orderId })
    .eq('registration_id', reg.id)
    .eq('status', 'pending')

  redirect(approvalUrl)
}
