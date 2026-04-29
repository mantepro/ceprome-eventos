'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { generateQRBuffer } from '@/lib/qr'
import { sendTicketEmail } from '@/lib/email'
import { renderComprobante, type ComprobanteData } from '@/lib/pdf/comprobante'
import { formatDate } from '@/lib/utils'

export async function generateAndSendTicket(registrationId: string): Promise<void> {
  const supabase = createAdminClient()

  const { data: ticket } = await supabase
    .from('tickets')
    .select(`
      id, token, organization_id, event_id,
      ticket_types(name, price, currency),
      registrations!inner(
        folio, total_amount, created_at,
        events(name, starts_at, location),
        attendees(first_name, last_name, email)
      )
    `)
    .eq('registration_id', registrationId)
    .eq('status', 'active')
    .single()

  if (!ticket) {
    console.error('[generateAndSendTicket] ticket activo no encontrado para registration', registrationId)
    return
  }

  const reg = ticket.registrations as {
    folio: string
    total_amount: number
    created_at: string
    events: { name: string; starts_at: string; location: string | null } | null
    attendees: { first_name: string; last_name: string; email: string }[]
  }

  const attendee = reg.attendees?.[0]
  const event = reg.events
  const ticketType = ticket.ticket_types as { name: string; price: number; currency: string } | null

  if (!attendee || !event) {
    console.error('[generateAndSendTicket] datos incompletos para registration', registrationId)
    return
  }

  // Generar buffer del QR a partir del token
  const qrBuffer = await generateQRBuffer(ticket.token)

  // Subir a Supabase Storage: tickets/{org_id}/{event_id}/{token}.png
  const storagePath = `${ticket.organization_id}/${ticket.event_id}/${ticket.token}.png`

  const { error: uploadError } = await supabase.storage
    .from('tickets')
    .upload(storagePath, qrBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

  if (uploadError) {
    console.error('[generateAndSendTicket] error subiendo QR a Storage:', uploadError.message)
    return
  }

  const { data: { publicUrl } } = supabase.storage
    .from('tickets')
    .getPublicUrl(storagePath)

  // Actualizar ticket con qr_url
  await supabase
    .from('tickets')
    .update({ qr_url: publicUrl })
    .eq('id', ticket.id)

  // Generar PDF comprobante
  let pdfBuffer: Buffer | undefined
  try {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', ticket.organization_id)
      .single()

    const comprobanteData: ComprobanteData = {
      orgName: org?.name ?? 'Organización',
      eventName: event.name,
      eventDate: formatDate(event.starts_at),
      eventLocation: event.location,
      attendeeName: `${attendee.first_name} ${attendee.last_name}`,
      attendeeEmail: attendee.email,
      ticketType: ticketType?.name ?? 'Acceso general',
      amount: reg.total_amount,
      currency: ticketType?.currency ?? 'USD',
      folio: reg.folio,
      registrationDate: formatDate(reg.created_at),
    }
    pdfBuffer = await renderComprobante(comprobanteData)
  } catch (err) {
    console.error('[generateAndSendTicket] error generando PDF:', err)
  }

  // Enviar correo
  try {
    await sendTicketEmail({
      to: attendee.email,
      firstName: attendee.first_name,
      lastName: attendee.last_name,
      folio: reg.folio,
      eventName: event.name,
      eventStartsAt: event.starts_at,
      eventLocation: event.location,
      ticketTypeName: ticketType?.name ?? 'Acceso general',
      qrUrl: publicUrl,
      qrBuffer,
      pdfBuffer,
    })
  } catch (err) {
    console.error('[generateAndSendTicket] error enviando correo:', err)
  }
}
