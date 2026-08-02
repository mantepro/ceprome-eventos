import { type NextRequest, NextResponse } from 'next/server'
import { capturePayPalOrder } from '@/lib/paypal'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateAndSendTicket } from '@/lib/actions/generate-ticket'
import { resolveBasePathBySlug } from '@/lib/org-domain'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl
  const token = searchParams.get('token') // PayPal order ID
  const folio = searchParams.get('folio')
  const slug = searchParams.get('slug')

  const supabase = createAdminClient()
  const basePath = await resolveBasePathBySlug(supabase, slug ?? '', req.headers.get('host'))

  const failUrl = folio && slug
    ? `${origin}${basePath}/confirmar/${folio}?pago=fallido`
    : `${origin}/`

  if (!token || !folio || !slug) {
    return NextResponse.redirect(failUrl)
  }

  try {
    // Verificar que el pago aún está pendiente (evita capturas duplicadas)
    const { data: payment } = await supabase
      .from('payments')
      .select('id, registration_id, status')
      .eq('external_ref', token)
      .single()

    if (!payment) return NextResponse.redirect(failUrl)
    if (payment.status === 'completed') {
      return NextResponse.redirect(`${origin}${basePath}/confirmar/${folio}`)
    }

    const result = await capturePayPalOrder(token)

    if (result.status !== 'COMPLETED') {
      return NextResponse.redirect(failUrl)
    }

    const now = new Date().toISOString()

    await Promise.all([
      supabase
        .from('payments')
        .update({ status: 'completed', verified_at: now })
        .eq('id', payment.id),

      supabase
        .from('registrations')
        .update({ status: 'paid' })
        .eq('id', payment.registration_id),

      supabase
        .from('tickets')
        .update({ status: 'active' })
        .eq('registration_id', payment.registration_id),
    ])

    try {
      await generateAndSendTicket(payment.registration_id)
    } catch (err) {
      console.error('[paypal/capture] generateAndSendTicket:', err)
    }

    return NextResponse.redirect(`${origin}${basePath}/confirmar/${folio}?pago=ok`)
  } catch {
    return NextResponse.redirect(failUrl)
  }
}
