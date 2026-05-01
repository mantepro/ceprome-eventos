import { type NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { capturePayPalOrder } from '@/lib/paypal'
import { confirmPaymentPublic } from '@/lib/actions/payments'

export async function POST(req: NextRequest) {
  try {
    const { orderId, folio, orgSlug } = await req.json() as {
      orderId: string
      folio: string
      orgSlug: string
    }
    if (!orderId || !folio || !orgSlug) {
      return NextResponse.json({ error: 'Parámetros inválidos.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: payment } = await supabase
      .from('payments')
      .select('id, registration_id, status')
      .eq('external_ref', orderId)
      .single()

    if (!payment) {
      return NextResponse.json({ error: 'Pago no encontrado.' }, { status: 404 })
    }

    // Idempotency: already captured
    if (payment.status === 'completed') {
      return NextResponse.json({ success: true, folio, orgSlug })
    }

    const result = await capturePayPalOrder(orderId)

    if (result.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'PayPal no completó el pago.' }, { status: 402 })
    }

    const confirm = await confirmPaymentPublic(payment.registration_id, 'paypal')
    if (confirm.error) {
      return NextResponse.json({ error: confirm.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, folio, orgSlug })
  } catch (err) {
    console.error('[paypal/capture-order]', err)
    return NextResponse.json({ error: 'Error al procesar el pago.' }, { status: 500 })
  }
}
