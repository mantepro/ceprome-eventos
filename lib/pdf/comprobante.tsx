import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 48,
    paddingBottom: 48,
    paddingHorizontal: 56,
    color: '#111',
  },
  header: {
    marginBottom: 28,
    borderBottom: '2px solid #111',
    paddingBottom: 12,
  },
  orgName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#222',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 10,
    color: '#555',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: '1px solid #eee',
  },
  rowLabel: {
    color: '#555',
    flex: 1,
  },
  rowValue: {
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginTop: 4,
    borderTop: '2px solid #111',
  },
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  folio: {
    marginTop: 32,
    padding: 12,
    backgroundColor: '#f5f5f5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folioLabel: {
    color: '#555',
    fontSize: 9,
  },
  folioValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  footer: {
    marginTop: 40,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
  disclaimer: {
    marginTop: 8,
    fontSize: 8,
    color: '#999',
    textAlign: 'center',
  },
})

export interface ComprobanteData {
  orgName: string
  eventName: string
  eventDate: string
  eventLocation: string | null
  attendeeName: string
  attendeeEmail: string
  ticketType: string
  amount: number
  currency: string
  folio: string
  registrationDate: string
}

function ComprobanteDocument({ data }: { data: ComprobanteData }) {
  const formattedAmount = `$${data.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${data.currency}`

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.orgName}>{data.orgName}</Text>
          <Text style={styles.title}>Comprobante de Inscripción</Text>
          <Text style={styles.subtitle}>Documento no fiscal — solo para fines de registro</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Evento</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Nombre</Text>
            <Text style={styles.rowValue}>{data.eventName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fecha</Text>
            <Text style={styles.rowValue}>{data.eventDate}</Text>
          </View>
          {data.eventLocation && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Lugar</Text>
              <Text style={styles.rowValue}>{data.eventLocation}</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Participante</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Nombre</Text>
            <Text style={styles.rowValue}>{data.attendeeName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Correo</Text>
            <Text style={styles.rowValue}>{data.attendeeEmail}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Inscripción</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Tipo de acceso</Text>
            <Text style={styles.rowValue}>{data.ticketType}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Fecha de registro</Text>
            <Text style={styles.rowValue}>{data.registrationDate}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formattedAmount}</Text>
          </View>
        </View>

        <View style={styles.folio}>
          <Text style={styles.folioLabel}>Folio de inscripción</Text>
          <Text style={styles.folioValue}>{data.folio}</Text>
        </View>

        <Text style={styles.footer}>{data.orgName} · Generado el {data.registrationDate}</Text>
        <Text style={styles.disclaimer}>
          Este comprobante no tiene valor fiscal. Para solicitar factura, consulta al organizador del evento.
        </Text>
      </Page>
    </Document>
  )
}

export async function renderComprobante(data: ComprobanteData): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  // Cast needed: renderToBuffer expects DocumentProps element; ComprobanteDocument wraps Document so types are compatible at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ComprobanteDocument, { data }) as any
  return renderToBuffer(element) as Promise<Buffer>
}
