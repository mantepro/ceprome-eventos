import { resend } from '@/lib/resend'
import { renderComprobante, type ComprobanteData } from '@/lib/pdf/comprobante'
import { getEmailLogoUri } from '@/lib/email/logo'

const INVOICE_TRIGGER = 'Sí, requiero factura fiscal'

export interface ConfirmationEmailParams {
  folio: string
  attendeeName: string
  attendeeEmail: string
  eventName: string
  eventDate: string
  eventLocation: string | null
  ticketType: string
  amount: number
  currency: string
  orgName: string
  orgEmail: string | null
  whatsappContact?: string | null
  paymentMethod: 'online' | 'manual' | 'preregister'
  extraData: Record<string, string | boolean>
  invoiceInstructions: string | null
  transferInstructions?: string | null
  registrationDate: string
  isPaid?: boolean
  payLink?: string
}

function buildHtml(params: ConfirmationEmailParams, invoiceRequested: boolean, logoUri: string | null): string {
  const { folio, attendeeName, eventName, eventDate, eventLocation, ticketType, amount, currency, orgName, orgEmail, whatsappContact, paymentMethod, invoiceInstructions, transferInstructions, isPaid, payLink } = params

  const formattedAmount = `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}`

  // ── Corrección 3: mensaje más explícito para pago manual ──
  const paymentNote =
    paymentMethod === 'preregister'
      ? `<p style="color:#1d4ed8;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 16px;margin:16px 0;">
          <strong>Pre-registro confirmado.</strong> Tu lugar está reservado. Te contactaremos con las instrucciones de pago próximamente.
         </p>`
      : paymentMethod === 'manual'
      ? `<div style="color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;">
          <p style="margin:0 0 6px;"><strong>Pago pendiente.</strong></p>
          <p style="margin:0;font-size:14px;line-height:1.6;">Tu lugar quedará confirmado únicamente cuando verifiquemos tu pago. Te enviaremos tu confirmación y código QR una vez validado.</p>
         </div>`
      : `<p style="color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px;margin:16px 0;">
          <strong>Tu pago está siendo procesado.</strong> Una vez confirmado recibirás tu ticket QR.
         </p>`

  const payButton = payLink
    ? `<div style="margin:16px 0;text-align:center;">
        <a href="${payLink}"
           style="display:inline-block;background:#a22944;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px;">
          Completar mi pago
        </a>
       </div>`
    : ''

  // ── Corrección 2: instrucciones de transferencia para pagos manuales ──
  const transferBlock = paymentMethod === 'manual'
    ? transferInstructions
      ? `<div style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <div style="background:#f9fafb;padding:8px 16px;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Instrucciones de transferencia</p>
          </div>
          <div style="padding:16px;white-space:pre-wrap;color:#374151;font-size:14px;line-height:1.6;">${transferInstructions}</div>
          <div style="padding:0 16px 16px;font-size:13px;color:#374151;">
            Incluye tu folio <strong style="font-family:monospace;">${folio}</strong> en el concepto del pago
            y envía tu comprobante a ${orgEmail ?? 'el correo del organizador'}.
          </div>
        </div>`
      : `<p style="font-size:13px;color:#374151;margin:0 0 24px;">
          Envía tu comprobante de pago a <strong>${orgEmail ?? 'el correo del organizador'}</strong>
          indicando tu folio <strong style="font-family:monospace;">${folio}</strong>.
        </p>`
    : ''

  // ── Corrección 1: sección de factura solo cuando el pago está confirmado ──
  const billingBlock = isPaid && invoiceInstructions
    ? `<div style="margin:24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#f9fafb;padding:8px 16px;border-bottom:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Para solicitar factura fiscal</p>
        </div>
        <div style="padding:16px;white-space:pre-wrap;color:#374151;font-size:14px;">${invoiceInstructions}</div>
      </div>`
    : isPaid && invoiceRequested
    ? `<p style="color:#6b7280;font-size:13px;margin:16px 0;">Has indicado que requieres factura fiscal. El organizador del evento se pondrá en contacto contigo.</p>`
    : `<p style="color:#6b7280;font-size:13px;margin:16px 0;">Adjuntamos tu comprobante de inscripción en PDF.</p>`

  return `<!DOCTYPE html>
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
          <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:12px;">Confirmación de inscripción</p>
        </td></tr>

        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;font-size:15px;">Hola <strong>${attendeeName}</strong>,</p>
          <p style="margin:0 0 24px;color:#374151;">Tu inscripción al evento <strong>${eventName}</strong> ha sido registrada.</p>

          ${paymentNote}

          ${(paymentMethod === 'preregister' || paymentMethod === 'manual') ? payButton : ''}

          ${transferBlock}

          <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:24px 0;">
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
                <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #f3f4f6;">${eventDate}${eventLocation ? ` · ${eventLocation}` : ''}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Tipo de acceso</td>
                <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #f3f4f6;">${ticketType}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;font-weight:700;">Total</td>
                <td style="padding:12px 16px;text-align:right;font-weight:700;font-size:16px;">${formattedAmount}</td>
              </tr>
            </table>
          </div>

          ${billingBlock}

          <p style="margin:24px 0 0;color:#6b7280;font-size:13px;">Guarda tu folio <strong>${folio}</strong> — lo necesitarás para cualquier consulta.</p>
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
}

export async function sendConfirmationEmail(params: ConfirmationEmailParams): Promise<void> {
  const invoiceRequested = Object.values(params.extraData).some(
    (v) => v === INVOICE_TRIGGER
  )

  const logoUri = await getEmailLogoUri()
  const html = buildHtml(params, invoiceRequested, logoUri)

  const comprobanteData: ComprobanteData = {
    orgName: params.orgName,
    eventName: params.eventName,
    eventDate: params.eventDate,
    eventLocation: params.eventLocation,
    attendeeName: params.attendeeName,
    attendeeEmail: params.attendeeEmail,
    ticketType: params.ticketType,
    amount: params.amount,
    currency: params.currency,
    folio: params.folio,
    registrationDate: params.registrationDate,
    docType: params.paymentMethod === 'preregister' ? 'prereg' : 'comprobante',
    invoiceInstructions: params.invoiceInstructions,
  }

  // Only attach PDF if not requesting invoice (invoice flow uses text instructions instead)
  const attachments =
    !invoiceRequested
      ? [
          {
            filename: `comprobante-${params.folio}.pdf`,
            content: await renderComprobante(comprobanteData),
          },
        ]
      : []

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'noreply@ceprome.org',
    to: params.attendeeEmail,
    subject: `Inscripción confirmada — ${params.eventName} (${params.folio})`,
    html,
    attachments,
  })
}
