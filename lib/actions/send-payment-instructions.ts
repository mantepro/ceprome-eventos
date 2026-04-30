'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'
import { sendPaymentInstructionsEmail } from '@/lib/email/payment-instructions'
import { formatDate } from '@/lib/utils'

export async function sendPaymentInstructions(
  registrationId: string
): Promise<{ error?: string }> {
  const profile = await getCurrentUserProfile()
  if (!profile) return { error: 'No autorizado.' }

  const supabase = createAdminClient()

  const { data: reg } = await supabase
    .from('registrations')
    .select(`
      id, folio, status, total_amount,
      events(name, starts_at, transfer_instructions),
      attendees(first_name, last_name, email),
      tickets(ticket_types(name, currency))
    `)
    .eq('id', registrationId)
    .eq('organization_id', profile.organization_id)
    .single()

  if (!reg) return { error: 'Inscripción no encontrada.' }
  if (reg.status !== 'draft' && reg.status !== 'pending') {
    return { error: 'Solo se pueden enviar instrucciones a pre-registros pendientes de pago.' }
  }

  const attendee = (reg.attendees as { first_name: string; last_name: string; email: string }[])?.[0]
  const event = reg.events as { name: string; starts_at: string; transfer_instructions: string | null } | null
  const ticketType = (reg.tickets as { ticket_types: { name: string; currency: string } | null }[])?.[0]?.ticket_types

  if (!attendee || !event) return { error: 'Datos incompletos para enviar el correo.' }

  const { data: org } = await supabase
    .from('organizations')
    .select('name, email, slug, whatsapp_contact')
    .eq('id', profile.organization_id)
    .single()

  if (!org) return { error: 'Organización no encontrada.' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const payLink = `${appUrl}/${org.slug}/pagar/${reg.folio}`

  try {
    await sendPaymentInstructionsEmail({
      to: attendee.email,
      attendeeName: `${attendee.first_name} ${attendee.last_name}`,
      folio: reg.folio,
      eventName: event.name,
      eventDate: formatDate(event.starts_at),
      ticketType: ticketType?.name ?? 'Acceso general',
      amount: reg.total_amount,
      currency: ticketType?.currency ?? 'USD',
      orgName: org.name,
      orgEmail: org.email,
      whatsappContact: org.whatsapp_contact,
      transferInstructions: event.transfer_instructions,
      payLink,
    })
  } catch {
    return { error: 'No se pudo enviar el correo. Intenta de nuevo.' }
  }

  return {}
}
