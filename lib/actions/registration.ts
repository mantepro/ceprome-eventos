'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { sendConfirmationEmail } from '@/lib/email/confirmation'
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
    firstName, lastName, email, phone, paymentMethod, extraData,
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
      total_amount: ticketType.price,
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
      amount: ticketType.price,
      currency: ticketType.currency,
      method: paymentMethod === 'online' ? 'paypal' : 'manual',
      status: 'pending',
    })

    if (paymentError) {
      console.error('[createRegistration] payments INSERT failed:', JSON.stringify(paymentError, null, 2))
      return { error: 'Error al registrar el pago.' }
    }
  }

  // Fire confirmation email — failure must not block the registration redirect
  try {
    const [{ data: eventData }, { data: orgData }] = await Promise.all([
      supabase
        .from('events')
        .select('name, starts_at, location, invoice_instructions')
        .eq('id', eventId)
        .single(),
      supabase
        .from('organizations')
        .select('name, email')
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
        amount: ticketType.price,
        currency: ticketType.currency,
        orgName: orgData.name,
        orgEmail: orgData.email,
        paymentMethod,
        extraData: (extraData as Record<string, string | boolean>) ?? {},
        invoiceInstructions: eventData.invoice_instructions,
        registrationDate: formatDate(new Date().toISOString()),
      })
    }
  } catch (err) {
    console.error('[sendConfirmationEmail]', err)
  }

  redirect(`/${orgSlug}/confirmar/${folio}`)
}
