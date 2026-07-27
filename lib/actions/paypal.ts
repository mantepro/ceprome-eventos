'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayPalOrder } from '@/lib/paypal'
import { resolveBasePathBySlug } from '@/lib/org-domain'

export async function initiatePayPalFromPagar(
  folio: string,
  orgSlug: string
): Promise<{ error: string }> {
  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, total_amount, status, events(name), tickets(ticket_types(currency))')
    .eq('folio', folio)
    .single()

  if (!reg) return { error: 'Inscripción no encontrada.' }
  if (reg.status !== 'draft' && reg.status !== 'pending') {
    return { error: 'Esta inscripción ya fue procesada.' }
  }

  const currency =
    (reg.tickets as { ticket_types: { currency: string } | null }[])?.[0]?.ticket_types?.currency ?? 'USD'
  const eventName =
    (reg.events as { name: string } | null)?.name ?? 'Evento CEPROME'

  // Update payment_method to 'online' and status to 'pending' if draft
  if (reg.status === 'draft') {
    await supabase
      .from('registrations')
      .update({ status: 'pending', payment_method: 'online' })
      .eq('id', reg.id)
  }

  // Create payment record if none exists
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, external_ref')
    .eq('registration_id', reg.id)
    .eq('status', 'pending')
    .maybeSingle()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const basePath = await resolveBasePathBySlug(supabase, orgSlug, (await headers()).get('host'))

  const { orderId, approvalUrl } = await createPayPalOrder({
    amount: reg.total_amount,
    currency,
    description: eventName,
    returnUrl: `${appUrl}/api/paypal/capture?folio=${folio}&slug=${orgSlug}`,
    cancelUrl: `${appUrl}${basePath}/pagar/${folio}?pago=cancelado`,
  })

  if (existingPayment) {
    await supabase
      .from('payments')
      .update({ external_ref: orderId })
      .eq('id', existingPayment.id)
  } else {
    const { data: orgData } = await supabase
      .from('registrations')
      .select('organization_id')
      .eq('id', reg.id)
      .single()

    if (orgData?.organization_id) {
      await supabase.from('payments').insert({
        registration_id: reg.id,
        organization_id: orgData.organization_id,
        amount: reg.total_amount,
        currency,
        method: 'paypal',
        status: 'pending',
        external_ref: orderId,
      })
    }
  }

  redirect(approvalUrl)
}

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
  const basePath = await resolveBasePathBySlug(supabase, orgSlug, (await headers()).get('host'))

  const { orderId, approvalUrl } = await createPayPalOrder({
    amount: reg.total_amount,
    currency: 'USD',
    description: eventName,
    returnUrl: `${appUrl}/api/paypal/capture?folio=${folio}&slug=${orgSlug}`,
    cancelUrl: `${appUrl}${basePath}/confirmar/${folio}?pago=cancelado`,
  })

  await supabase
    .from('payments')
    .update({ external_ref: orderId })
    .eq('registration_id', reg.id)
    .eq('status', 'pending')

  redirect(approvalUrl)
}
