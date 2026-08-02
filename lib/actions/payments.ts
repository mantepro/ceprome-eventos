'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import { generateAndSendTicket } from '@/lib/actions/generate-ticket'

export type PaymentMethod = 'paypal' | 'manual' | 'transferencia' | 'deposito' | 'taquilla' | 'otro'

export async function confirmPaymentPublic(
  registrationId: string,
  method: PaymentMethod = 'paypal'
): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, status, total_amount, organization_id')
    .eq('id', registrationId)
    .single()

  if (!reg) return { error: 'Inscripción no encontrada.' }
  if (reg.status === 'paid') return {}

  const { data: pendingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('registration_id', registrationId)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingPayment) {
    await supabase
      .from('payments')
      .update({ status: 'completed', method, verified_at: new Date().toISOString() })
      .eq('id', pendingPayment.id)
  } else {
    const { data: completedPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .eq('status', 'completed')
      .maybeSingle()

    if (!completedPayment) {
      const { data: ticketRow } = await supabase
        .from('tickets')
        .select('ticket_types(currency)')
        .eq('registration_id', registrationId)
        .limit(1)
        .maybeSingle()
      const currency = (ticketRow?.ticket_types as { currency: string } | null)?.currency ?? 'USD'

      await supabase.from('payments').insert({
        registration_id: registrationId,
        organization_id: reg.organization_id,
        amount: reg.total_amount,
        currency,
        method,
        status: 'completed',
        verified_at: new Date().toISOString(),
      })
    }
  }

  await supabase.from('registrations').update({ status: 'paid' }).eq('id', registrationId)
  await supabase
    .from('tickets')
    .update({ status: 'active' })
    .eq('registration_id', registrationId)
    .eq('status', 'pending')

  try {
    await generateAndSendTicket(registrationId)
  } catch (err) {
    console.error('[confirmPaymentPublic] generateAndSendTicket:', err)
  }

  return {}
}

export async function confirmPayment(
  registrationId: string,
  method: PaymentMethod = 'manual'
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select('id, status, total_amount')
    .eq('id', registrationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!reg) return { error: 'Inscripción no encontrada.' }
  if (reg.status === 'paid') return {}

  // If there's a pending payment record, mark it completed
  const { data: pendingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('registration_id', registrationId)
    .eq('status', 'pending')
    .maybeSingle()

  if (pendingPayment) {
    await supabase
      .from('payments')
      .update({
        status: 'completed',
        method,
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
      })
      .eq('id', pendingPayment.id)
  } else {
    // No pending payment — check if already completed to avoid duplicate
    const { data: completedPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', registrationId)
      .eq('status', 'completed')
      .maybeSingle()

    if (!completedPayment) {
      const { data: ticketRow } = await supabase
        .from('tickets')
        .select('ticket_types(currency)')
        .eq('registration_id', registrationId)
        .limit(1)
        .maybeSingle()
      const currency = (ticketRow?.ticket_types as { currency: string } | null)?.currency ?? 'USD'

      await supabase.from('payments').insert({
        registration_id: registrationId,
        organization_id: profile.organization_id,
        amount: reg.total_amount,
        currency,
        method,
        status: 'completed',
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
      })
    }
  }

  await supabase
    .from('registrations')
    .update({ status: 'paid' })
    .eq('id', registrationId)

  await supabase
    .from('tickets')
    .update({ status: 'active' })
    .eq('registration_id', registrationId)
    .eq('status', 'pending')

  try {
    await generateAndSendTicket(registrationId)
  } catch (err) {
    console.error('[confirmPayment] generateAndSendTicket:', err)
  }

  revalidatePath('/admin/pagos')
  revalidatePath('/admin/inscritos')
  revalidatePath('/admin')

  return {}
}

export async function validatePayment(paymentId: string, method: PaymentMethod = 'manual'): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('id, registration_id, status')
    .eq('id', paymentId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!payment) return { error: 'Pago no encontrado.' }
  if (payment.status !== 'pending') return { error: 'Este pago ya fue procesado.' }

  return confirmPayment(payment.registration_id, method)
}

export async function rejectPayment(paymentId: string): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()
  const { data: payment } = await supabase
    .from('payments')
    .select('id, registration_id, status')
    .eq('id', paymentId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!payment) return { error: 'Pago no encontrado.' }
  if (payment.status !== 'pending') return { error: 'Este pago ya fue procesado.' }

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      verified_by: profile.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  await supabase
    .from('registrations')
    .update({ status: 'cancelled' })
    .eq('id', payment.registration_id)

  await supabase
    .from('tickets')
    .update({ status: 'cancelled' })
    .eq('registration_id', payment.registration_id)

  revalidatePath('/admin/pagos')
  revalidatePath('/admin/inscritos')
  revalidatePath('/admin')

  return {}
}
