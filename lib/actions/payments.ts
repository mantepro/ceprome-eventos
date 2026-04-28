'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateAndSendTicket } from '@/lib/actions/generate-ticket'

export async function validatePayment(
  paymentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado.' }

  const { data: payment } = await supabase
    .from('payments')
    .select('id, registration_id, organization_id, status')
    .eq('id', paymentId)
    .single()

  if (!payment) return { error: 'Pago no encontrado.' }
  if (payment.status !== 'pending') return { error: 'Este pago ya fue procesado.' }

  const { error: payErr } = await supabase
    .from('payments')
    .update({
      status: 'completed',
      verified_by: user.id,
      verified_at: new Date().toISOString(),
    })
    .eq('id', paymentId)

  if (payErr) return { error: 'Error al validar el pago.' }

  await supabase
    .from('registrations')
    .update({ status: 'paid' })
    .eq('id', payment.registration_id)

  await supabase
    .from('tickets')
    .update({ status: 'active' })
    .eq('registration_id', payment.registration_id)
    .eq('status', 'pending')

  generateAndSendTicket(payment.registration_id).catch((err) =>
    console.error('[validatePayment] generateAndSendTicket:', err)
  )

  revalidatePath('/admin/pagos')
  revalidatePath('/admin/inscritos')
  revalidatePath('/admin')

  return {}
}

export async function rejectPayment(
  paymentId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autorizado.' }

  const { data: payment } = await supabase
    .from('payments')
    .select('id, registration_id, status')
    .eq('id', paymentId)
    .single()

  if (!payment) return { error: 'Pago no encontrado.' }
  if (payment.status !== 'pending') return { error: 'Este pago ya fue procesado.' }

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      verified_by: user.id,
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
