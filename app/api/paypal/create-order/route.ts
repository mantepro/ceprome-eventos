import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayPalOrder } from '@/lib/paypal'

export async function POST(req: NextRequest) {
  try {
    const { folio, orgSlug } = await req.json() as { folio: string; orgSlug: string }
    if (!folio || !orgSlug) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: reg } = await supabase
      .from('registrations')
      .select(`
        id, total_amount, status, organization_id,
        events(name),
        tickets(ticket_types(currency))
      `)
      .eq('folio', folio)
      .single()

    if (!reg) return NextResponse.json({ error: 'Inscripción no encontrada.' }, { status: 404 })
    if (reg.status !== 'draft' && reg.status !== 'pending') {
      return NextResponse.json({ error: 'Esta inscripción ya fue procesada.' }, { status: 409 })
    }

    const currency =
      (reg.tickets as { ticket_types: { currency: string } | null }[])?.[0]?.ticket_types?.currency ?? 'USD'
    const eventName =
      (reg.events as { name: string } | null)?.name ?? 'Inscripción'

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    const { orderId } = await createPayPalOrder({
      amount: reg.total_amount,
      currency,
      description: eventName,
      returnUrl: `${appUrl}/api/paypal/capture?folio=${folio}&slug=${orgSlug}`,
      cancelUrl: `${appUrl}/${orgSlug}/pagar/${folio}?pago=cancelado`,
    })

    // Move draft → pending so the slot is reserved
    if (reg.status === 'draft') {
      await supabase
        .from('registrations')
        .update({ status: 'pending', payment_method: 'online' })
        .eq('id', reg.id)
    }

    // Upsert pending payment record with orderId as external_ref
    const { data: existing } = await supabase
      .from('payments')
      .select('id')
      .eq('registration_id', reg.id)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      await supabase
        .from('payments')
        .update({ external_ref: orderId, method: 'paypal' })
        .eq('id', existing.id)
    } else {
      await supabase.from('payments').insert({
        registration_id: reg.id,
        organization_id: reg.organization_id,
        amount: reg.total_amount,
        currency,
        method: 'paypal',
        status: 'pending',
        external_ref: orderId,
      })
    }

    return NextResponse.json({ orderId })
  } catch (err) {
    console.error('[paypal/create-order]', err)
    return NextResponse.json({ error: 'Error al crear la orden de pago.' }, { status: 500 })
  }
}
