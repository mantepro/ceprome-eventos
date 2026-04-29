import { Resend } from 'resend'
import { formatDate } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

export type TicketEmailParams = {
  to: string
  firstName: string
  lastName: string
  folio: string
  eventName: string
  eventStartsAt: string
  eventLocation: string | null
  ticketTypeName: string
  qrUrl: string
  qrBuffer: Buffer
  pdfBuffer?: Buffer
}

export async function sendTicketEmail(params: TicketEmailParams) {
  const {
    to, firstName, lastName, folio,
    eventName, eventStartsAt, eventLocation,
    ticketTypeName, qrUrl, qrBuffer, pdfBuffer,
  } = params

  const attachments: { filename: string; content: string }[] = [
    { filename: `ticket-${folio}.png`, content: qrBuffer.toString('base64') },
  ]
  if (pdfBuffer) {
    attachments.push({ filename: `comprobante-${folio}.pdf`, content: pdfBuffer.toString('base64') })
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to,
    subject: `Tu ticket — ${eventName} · ${folio}`,
    html: buildEmailHtml(params),
    attachments,
  })

  if (error) {
    console.error('[sendTicketEmail]', error)
    throw new Error('No se pudo enviar el correo.')
  }
}

function buildEmailHtml({
  firstName,
  folio,
  eventName,
  eventStartsAt,
  eventLocation,
  ticketTypeName,
  qrUrl,
}: TicketEmailParams): string {
  const dateStr = formatDate(eventStartsAt)

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tu ticket — ${eventName}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#a5b4fc;font-size:12px;letter-spacing:2px;text-transform:uppercase;">VI Congreso Latinoamericano</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">CEPROME 2027</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;color:#374151;font-size:16px;">Hola, <strong>${firstName}</strong>.</p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
                Tu pago fue confirmado. Aquí está tu acceso al evento.
              </p>

              <!-- Event card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Evento</p>
                    <p style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:700;">${eventName}</p>
                    <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">📅 ${dateStr}</p>
                    ${eventLocation ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;">📍 ${eventLocation}</p>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Ticket info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="50%" style="padding:0 8px 0 0;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Folio</p>
                    <p style="margin:0;color:#111827;font-size:16px;font-weight:700;font-family:monospace;">${folio}</p>
                  </td>
                  <td width="50%" style="padding:0 0 0 8px;">
                    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Tipo de acceso</p>
                    <p style="margin:0;color:#111827;font-size:16px;font-weight:700;">${ticketTypeName}</p>
                  </td>
                </tr>
              </table>

              <!-- QR -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px;text-align:center;">
                    <p style="margin:0 0 16px;color:#374151;font-size:13px;font-weight:600;">
                      Presenta este código QR el día del evento
                    </p>
                    <img src="${qrUrl}" alt="Código QR" width="200" height="200"
                      style="display:block;margin:0 auto;border-radius:4px;" />
                    <p style="margin:12px 0 0;color:#9ca3af;font-size:11px;">
                      Si la imagen no carga, el QR también está adjunto a este correo.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
                Guarda este correo o descarga el archivo adjunto.<br/>
                <strong>No compartas tu código QR</strong> — es personal e intransferible.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                CEPROME Latinoamérica · registro.cepromelat.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
