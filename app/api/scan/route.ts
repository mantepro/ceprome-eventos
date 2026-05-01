import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ScanResult } from '@/lib/types/scan'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await request.json()
  const { token, event_id } = body as { token: string; event_id: string }
  if (!token || !event_id) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 403 })

  const { data: ticket } = await admin
    .from('tickets')
    .select(`
      id, status, checked_in_at, organization_id, event_id, kit_station_id,
      ticket_types(name),
      attendees(first_name, last_name),
      registrations(folio, status)
    `)
    .eq('token', token)
    .single()

  let result: ScanResult['result']

  const reg = ticket?.registrations as unknown as { folio: string; status: string } | null

  if (
    !ticket ||
    ticket.organization_id !== profile.organization_id ||
    ticket.event_id !== event_id
  ) {
    result = 'not_found'
  } else if (reg?.status === 'cancelled') {
    result = 'cancelled'
  } else if (ticket.status === 'pending') {
    result = 'pending_payment'
  } else if (ticket.status === 'cancelled') {
    result = 'cancelled'
  } else if (ticket.status === 'used') {
    result = 'already_used'
  } else if (ticket.status === 'active') {
    result = reg?.status === 'paid' ? 'valid' : 'valid_pending_payment'
    await admin
      .from('tickets')
      .update({ status: 'used', checked_in_at: new Date().toISOString() })
      .eq('id', ticket.id)
  } else {
    result = 'not_found'
  }

  // Log every scan that has a known ticket.
  // valid_pending_payment is stored as 'valid' to satisfy the scan_logs CHECK constraint.
  if (ticket && result !== 'not_found') {
    await admin.from('scan_logs').insert({
      ticket_id: ticket.id,
      organization_id: profile.organization_id,
      event_id,
      scanned_by: user.id,
      result: result === 'valid_pending_payment' ? 'valid' : result,
    })
  }

  const response: ScanResult = { result }

  if ((result === 'valid' || result === 'valid_pending_payment' || result === 'already_used') && ticket) {
    const attendee = ticket.attendees as unknown as { first_name: string; last_name: string } | null
    const tt = ticket.ticket_types as unknown as { name: string } | null

    let kitStation: string | null = null
    if (ticket.kit_station_id) {
      const { data: station } = await admin
        .from('kit_delivery_stations')
        .select('name')
        .eq('id', ticket.kit_station_id)
        .single()
      kitStation = station?.name ?? null
    }

    response.attendee = {
      name: attendee ? `${attendee.first_name} ${attendee.last_name}` : '—',
      folio: reg?.folio ?? '—',
      ticketType: tt?.name ?? '—',
      kitStation,
    }

    if (result === 'already_used') {
      response.checked_in_at = ticket.checked_in_at
    }
  }

  return NextResponse.json(response)
}
