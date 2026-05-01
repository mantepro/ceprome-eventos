'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendConfirmationEmail } from '@/lib/email/confirmation'
import { validateCoupon } from '@/lib/actions/coupons'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  orgSlug: z.string().min(1),
  orgId: z.string().uuid(),
  eventId: z.string().uuid(),
  ticketTypeId: z.string().uuid(),
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().refine(
    (v) => { const d = v.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15 },
    { message: 'Teléfono inválido (8–15 dígitos)' }
  ),
  paymentMethod: z.enum(['online', 'manual', 'preregister']),
  extraData: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
  couponCode: z.string().optional(),
})

export type CreateRegistrationInput = z.infer<typeof schema>

function generateFolio(): string {
  const year = new Date().getFullYear()
  const code = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `REG-${year}-${code}`
}

export async function createRegistration(
  input: CreateRegistrationInput
): Promise<{ error: string }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { error: 'Datos inválidos. Verifica el formulario.' }

  const {
    orgSlug, orgId, eventId, ticketTypeId,
    firstName, lastName, email, phone, paymentMethod, extraData, couponCode,
  } = parsed.data

  const supabase = await createClient()

  const { data: ticketType } = await supabase
    .from('ticket_types')
    .select('id, name, price, currency, capacity, sold_count')
    .eq('id', ticketTypeId)
    .eq('event_id', eventId)
    .eq('organization_id', orgId)
    .eq('active', true)
    .single()

  if (!ticketType) return { error: 'Tipo de inscripción no disponible.' }

  if (
    ticketType.capacity !== null &&
    ticketType.sold_count >= ticketType.capacity
  ) {
    return { error: 'Este tipo de inscripción ya no tiene lugares disponibles.' }
  }

  // Validate coupon server-side
  let couponId: string | null = null
  let discountAmount = 0
  if (couponCode?.trim()) {
    const couponResult = await validateCoupon(couponCode.trim(), orgId, eventId, ticketType.price)
    if (!couponResult.valid) return { error: `Cupón inválido: ${couponResult.error}` }
    couponId = couponResult.couponId
    discountAmount = couponResult.discountAmount
  }

  const finalAmount = Math.max(0, ticketType.price - discountAmount)

  const isPreregister = paymentMethod === 'preregister'
  const folio = generateFolio()
  const registrationId = crypto.randomUUID()
  const attendeeId = crypto.randomUUID()

  const { error: regError } = await supabase
    .from('registrations')
    .insert({
      id: registrationId,
      organization_id: orgId,
      event_id: eventId,
      folio,
      status: isPreregister ? 'draft' : 'pending',
      payment_method: isPreregister ? null : paymentMethod,
      total_amount: finalAmount,
      discount_amount: discountAmount,
      coupon_id: couponId,
    })

  if (regError) {
    console.error('[createRegistration] registrations INSERT failed:', JSON.stringify(regError, null, 2))
    return { error: 'Error al crear la inscripción. Intenta de nuevo.' }
  }

  const { error: attError } = await supabase
    .from('attendees')
    .insert({
      id: attendeeId,
      registration_id: registrationId,
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: phone ?? null,
      extra_data: extraData && Object.keys(extraData).length > 0 ? extraData : null,
    })

  if (attError) {
    console.error('[createRegistration] attendees INSERT failed:', JSON.stringify(attError, null, 2))
    return { error: 'Error al guardar los datos del asistente.' }
  }

  const { error: ticketError } = await supabase.from('tickets').insert({
    registration_id: registrationId,
    attendee_id: attendeeId,
    ticket_type_id: ticketTypeId,
    organization_id: orgId,
    event_id: eventId,
    token: crypto.randomUUID(),
    status: 'pending',
  })

  if (ticketError) {
    console.error('[createRegistration] tickets INSERT failed:', JSON.stringify(ticketError, null, 2))
    return { error: 'Error al generar el ticket.' }
  }

  // No payment record for pre-registrations — they haven't committed to a method yet
  if (!isPreregister) {
    const { error: paymentError } = await supabase.from('payments').insert({
      registration_id: registrationId,
      organization_id: orgId,
      amount: finalAmount,
      currency: ticketType.currency,
      method: paymentMethod === 'online' ? 'paypal' : 'manual',
      status: 'pending',
    })

    if (paymentError) {
      console.error('[createRegistration] payments INSERT failed:', JSON.stringify(paymentError, null, 2))
      return { error: 'Error al registrar el pago.' }
    }
  }

  // Increment coupon used_count
  if (couponId) {
    const adminSupa = createAdminClient()
    const { data: couponRow } = await adminSupa
      .from('coupons')
      .select('used_count')
      .eq('id', couponId)
      .single()
    if (couponRow) {
      await adminSupa
        .from('coupons')
        .update({ used_count: couponRow.used_count + 1 })
        .eq('id', couponId)
    }
  }

  // Fire confirmation email — failure must not block the registration redirect
  try {
    const [{ data: eventData }, { data: orgData }] = await Promise.all([
      supabase
        .from('events')
        .select('name, starts_at, location, invoice_instructions, transfer_instructions')
        .eq('id', eventId)
        .single(),
      supabase
        .from('organizations')
        .select('name, email, whatsapp_contact')
        .eq('id', orgId)
        .single(),
    ])

    if (eventData && orgData) {
      await sendConfirmationEmail({
        folio,
        attendeeName: `${firstName} ${lastName}`,
        attendeeEmail: email,
        eventName: eventData.name,
        eventDate: formatDate(eventData.starts_at),
        eventLocation: eventData.location,
        ticketType: ticketType.name,
        amount: finalAmount,
        currency: ticketType.currency,
        orgName: orgData.name,
        orgEmail: orgData.email,
        whatsappContact: orgData.whatsapp_contact,
        paymentMethod,
        extraData: (extraData as Record<string, string | boolean>) ?? {},
        invoiceInstructions: eventData.invoice_instructions,
        transferInstructions: eventData.transfer_instructions,
        isPaid: false,
        registrationDate: formatDate(new Date().toISOString()),
      })
    }
  } catch (err) {
    console.error('[sendConfirmationEmail]', err)
  }

  redirect(`/${orgSlug}/confirmar/${folio}`)
}
