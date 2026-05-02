import { resend } from '@/lib/resend'
import { getEmailLogoUri } from '@/lib/email/logo'

export interface PaymentInstructionsEmailParams {
  to: string
  attendeeName: string
  folio: string
  eventName: string
  eventDate: string
  ticketType: string
  amount: number
  currency: string
  orgName: string
  orgEmail: string | null
  whatsappContact: string | null
  transferInstructions: string | null
  payLink: string
}

export async function sendPaymentInstructionsEmail(
  params: PaymentInstructionsEmailParams
): Promise<void> {
  const {
    to, attendeeName, folio, eventName, eventDate,
    ticketType, amount, currency, orgName, orgEmail,
    whatsappContact, transferInstructions, payLink,
  } = params

  const formattedAmount = `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}`
  const logoUri = await getEmailLogoUri()

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <tr><td style="background:#a22944;padding:24px 32px;">
          ${logoUri
            ? `<img src="${logoUri}" alt="${orgName}" height="44" style="display:block;max-width:266px;" />`
            : `<p style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:2px;">${orgName}</p>`
          }
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Instrucciones de pago</p>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;">Hola <strong>${attendeeName}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;">
            Tu pre-registro para <strong>${eventName}</strong> está confirmado.
            Completa tu pago para asegurar tu lugar.
          </p>

          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 24px;">
            <div style="background:#f9fafb;padding:8px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Resumen de inscripción</p>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
              <tr>
                <td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Folio</td>
                <td style="padding:10px 16px;text-align:right;font-family:monospace;font-weight:700;font-size:16px;border-bottom:1px solid #f3f4f6;">${folio}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Evento</td>
                <td style="padding:10px 16px;text-align:right;font-weight:600;border-bottom:1px solid #f3f4f6;">${eventName}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Fecha</td>
                <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #f3f4f6;">${eventDate}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Tipo de acceso</td>
                <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #f3f4f6;">${ticketType}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-weight:700;">Total a pagar</td>
                <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:16px;">${formattedAmount}</td>
              </tr>
            </table>
          </div>

          <div style="margin:0 0 24px;text-align:center;">
            <a href="${payLink}"
               style="display:inline-block;background:#a22944;color:#fff;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;">
              Pagar en línea con PayPal →
            </a>
            <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">O usa las instrucciones de transferencia a continuación</p>
          </div>

          ${transferInstructions ? `
          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:0 0 24px;">
            <div style="background:#f9fafb;padding:8px 16px;border-bottom:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Instrucciones de transferencia</p>
            </div>
            <div style="padding:16px;white-space:pre-wrap;color:#374151;font-size:14px;line-height:1.6;">${transferInstructions}</div>
          </div>
          <p style="font-size:13px;color:#374151;margin:0 0 24px;">
            Al realizar tu transferencia, incluye tu folio <strong style="font-family:monospace;">${folio}</strong> en el concepto del pago
            y envía el comprobante a ${orgEmail ?? 'el correo del organizador'}.
          </p>
          ` : `
          <p style="font-size:13px;color:#374151;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 24px;">
            Para pagar por transferencia, contacta a ${orgEmail ?? 'el organizador del evento'} indicando tu folio
            <strong style="font-family:monospace;"> ${folio}</strong>.
          </p>
          `}

          <p style="margin:0;color:#6b7280;font-size:13px;">
            Guarda tu folio <strong>${folio}</strong> — lo necesitarás para cualquier consulta.
          </p>
        </td></tr>

        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">${orgName}${orgEmail ? ` · ${orgEmail}` : ''}</p>
          ${whatsappContact ? `<p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">WhatsApp de contacto: ${whatsappContact}</p>` : ''}
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'noreply@ceprome.org',
    to,
    subject: `Instrucciones de pago — ${eventName} (${folio})`,
    html,
  })
}
