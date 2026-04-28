import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUserProfile } from '@/lib/queries/admin'

export async function GET(request: Request) {
  const profile = await getCurrentUserProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  const status = searchParams.get('status')

  const supabase = createAdminClient()

  let regQuery = supabase
    .from('registrations')
    .select(`
      id, folio, status, payment_method, total_amount, created_at, event_id,
      events(id, name),
      attendees(first_name, last_name, email, phone, extra_data),
      tickets(ticket_types(name, currency))
    `)
    .eq('organization_id', profile.organization_id)
    .order('created_at', { ascending: false })

  if (eventId) regQuery = regQuery.eq('event_id', eventId)
  if (status) regQuery = regQuery.eq('status', status as 'draft' | 'pending' | 'paid' | 'cancelled')

  const { data: regs } = await regQuery

  let fieldsQuery = supabase
    .from('event_fields')
    .select('id, event_id, label, scope')
    .eq('organization_id', profile.organization_id)
    .eq('active', true)
    .order('sort_order', { ascending: true })

  if (eventId) fieldsQuery = fieldsQuery.eq('event_id', eventId)

  const { data: fields } = await fieldsQuery

  const rows = regs ?? []
  const allFields = fields ?? []
  const participantFields = allFields.filter(f => f.scope === 'participant')
  const internalFields = allFields.filter(f => f.scope === 'internal')

  let eventName = ''
  if (eventId && rows[0]) {
    eventName = (rows[0].events as { name: string } | null)?.name ?? ''
  }

  const now = new Date()
  const ts = now.toISOString().slice(0, 16).replace('T', '-').replace(':', '-')
  const eventSlug = eventName
    ? eventName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 30)
    : 'todos'
  const filename = `inscritos-${eventSlug}-${ts}.xlsx`

  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Inscritos')

  const baseHeaders = [
    'Folio', 'Nombre', 'Apellido', 'Email', 'Teléfono',
    'Evento', 'Tipo de acceso', 'Monto', 'Moneda',
    'Método de pago', 'Estado', 'Fecha de inscripción',
  ]
  const pHeaders = participantFields.map(f => f.label)
  const iHeaders = internalFields.map(f => `${f.label} (Interno)`)
  const allHeaders = [...baseHeaders, ...pHeaders, ...iHeaders]

  const metaRow = sheet.addRow([
    `Exportado el ${now.toLocaleString('es-MX')} — Total: ${rows.length} inscripciones`,
  ])
  if (allHeaders.length > 1) {
    sheet.mergeCells(1, 1, 1, allHeaders.length)
  }
  metaRow.font = { italic: true, color: { argb: 'FF888888' } }

  sheet.addRow([])

  const headerRow = sheet.addRow(allHeaders)
  headerRow.font = { bold: true }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3F4F6' },
  }
  headerRow.border = {
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  }

  const statusMap: Record<string, string> = {
    draft: 'Borrador',
    pending: 'Pendiente',
    paid: 'Pagado',
    cancelled: 'Cancelado',
  }
  const methodMap: Record<string, string> = {
    manual: 'Transferencia',
    online: 'PayPal',
  }

  for (const reg of rows) {
    const att = (reg.attendees as {
      first_name: string; last_name: string; email: string; phone: string | null
      extra_data: Record<string, unknown> | null
    }[])?.[0]

    const ticketType = (reg.tickets as { ticket_types: { name: string; currency: string } | null }[])?.[0]?.ticket_types
    const evName = (reg.events as { name: string } | null)?.name ?? ''
    const extra = (att?.extra_data as Record<string, unknown>) ?? {}

    sheet.addRow([
      reg.folio,
      att?.first_name ?? '',
      att?.last_name ?? '',
      att?.email ?? '',
      att?.phone ?? '',
      evName,
      ticketType?.name ?? '',
      reg.total_amount,
      ticketType?.currency ?? '',
      reg.payment_method ? (methodMap[reg.payment_method] ?? reg.payment_method) : '',
      statusMap[reg.status] ?? reg.status,
      new Date(reg.created_at).toLocaleString('es-MX'),
      ...participantFields.map(f => {
        const v = extra[f.id]
        return v === true ? 'Sí' : v === false ? 'No' : (v as string) ?? ''
      }),
      ...internalFields.map(f => {
        const v = extra[f.id]
        return v === true ? 'Sí' : v === false ? 'No' : (v as string) ?? ''
      }),
    ])
  }

  const colWidths = [
    16, 18, 18, 28, 16, 30, 20, 10, 8, 16, 12, 20,
    ...participantFields.map(() => 20),
    ...internalFields.map(() => 20),
  ]
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })

  sheet.getColumn(8).numFmt = '#,##0.00'

  const buffer = await workbook.xlsx.writeBuffer()

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
