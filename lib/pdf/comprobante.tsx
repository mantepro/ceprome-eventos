import React from 'react'
import path from 'path'
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'

// CEPROME brand palette
const C = {
  guinda:   '#a22944',
  grisClaro: '#d9d9d9',
  grisOscuro: '#585857',
  negro:    '#111111',
  blanco:   '#ffffff',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: C.negro,
    backgroundColor: C.blanco,
    // No page-level padding — header must bleed to edges
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: C.guinda,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  headerLogo: {
    height: 44,
    width: 266,  // preserves 500:82.76 aspect ratio at h=44
  },
  headerLogoFallback: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: C.blanco,
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 10,
    color: C.blanco,
    letterSpacing: 0.5,
    marginTop: 4,
    opacity: 0.9,
  },
  headerDocType: {
    fontSize: 8,
    color: C.blanco,
    opacity: 0.7,
    textAlign: 'right',
    marginTop: 2,
  },

  // ── Separator ─────────────────────────────────────────────────────────────
  separator: {
    height: 1,
    backgroundColor: C.grisClaro,
  },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: {
    paddingHorizontal: 40,
    paddingTop: 24,
    paddingBottom: 40,
  },

  // ── Sections ──────────────────────────────────────────────────────────────
  section: {
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.guinda,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },

  // ── Data rows ─────────────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottom: `1px solid ${C.grisClaro}`,
  },
  rowLabel: {
    color: C.grisOscuro,
    flex: 1,
  },
  rowValue: {
    fontFamily: 'Helvetica-Bold',
    flex: 1,
    textAlign: 'right',
    color: C.negro,
  },

  // ── Total row ─────────────────────────────────────────────────────────────
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: C.guinda,
  },
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: C.blanco,
  },
  totalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: C.blanco,
  },

  // ── Folio block ───────────────────────────────────────────────────────────
  folioBlock: {
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: C.grisClaro,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  folioLabel: {
    color: C.grisOscuro,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  folioValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    letterSpacing: 2,
    color: C.guinda,
  },

  // ── QR section ────────────────────────────────────────────────────────────
  qrSection: {
    marginTop: 20,
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.guinda,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  qrImage: {
    width: 140,
    height: 140,
  },

  // ── Invoice section ───────────────────────────────────────────────────────
  invoiceSection: {
    marginTop: 20,
    padding: 12,
    border: `1px solid ${C.grisClaro}`,
  },
  invoiceSectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.guinda,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  invoiceSectionBody: {
    fontSize: 9,
    color: C.grisOscuro,
    lineHeight: 1.5,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footerSeparator: {
    height: 1,
    backgroundColor: C.grisClaro,
    marginTop: 28,
    marginBottom: 10,
  },
  footer: {
    fontSize: 8,
    color: C.grisOscuro,
    textAlign: 'center',
  },
  disclaimer: {
    marginTop: 4,
    fontSize: 8,
    color: C.grisOscuro,
    textAlign: 'center',
    opacity: 0.7,
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
  docType?: 'comprobante' | 'prereg'
  invoiceInstructions?: string | null
  qrDataUri?: string
}

function ComprobanteDocument({ data, logoUri }: { data: ComprobanteData; logoUri: string | null }) {
  const formattedAmount = `$${data.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${data.currency}`
  const isPrereg = data.docType === 'prereg'

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUri
              ? <Image src={logoUri} style={styles.headerLogo} />
              : <Text style={styles.headerLogoFallback}>CEPROME</Text>
            }
            <Text style={styles.headerTitle}>
              {isPrereg ? 'Confirmación de Pre-registro' : 'Comprobante de Inscripción'}
            </Text>
          </View>
          <Text style={styles.headerDocType}>
            {isPrereg
              ? 'Pre-registro — no es comprobante de pago'
              : 'Documento no fiscal'}
          </Text>
        </View>

        <View style={styles.separator} />

        {/* ── Body ── */}
        <View style={styles.body}>

          {/* Evento */}
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
            {data.eventLocation ? (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Lugar</Text>
                <Text style={styles.rowValue}>{data.eventLocation}</Text>
              </View>
            ) : null}
          </View>

          {/* Participante */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Participante</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Nombre</Text>
              <Text style={styles.rowValue}>{data.attendeeName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Correo electrónico</Text>
              <Text style={styles.rowValue}>{data.attendeeEmail}</Text>
            </View>
          </View>

          {/* Inscripción */}
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

          {/* Folio */}
          <View style={styles.folioBlock}>
            <Text style={styles.folioLabel}>Folio de inscripción</Text>
            <Text style={styles.folioValue}>{data.folio}</Text>
          </View>

          {/* QR */}
          {data.qrDataUri && (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Presenta este código QR el día del evento</Text>
              <Image src={data.qrDataUri} style={styles.qrImage} />
            </View>
          )}

          {/* Instrucciones de factura */}
          {!isPrereg && data.invoiceInstructions ? (
            <View style={styles.invoiceSection}>
              <Text style={styles.invoiceSectionLabel}>Para solicitar factura fiscal</Text>
              <Text style={styles.invoiceSectionBody}>{data.invoiceInstructions}</Text>
            </View>
          ) : null}

          {/* Footer */}
          <View style={styles.footerSeparator} />
          <Text style={styles.footer}>{data.orgName} · Generado el {data.registrationDate}</Text>
          <Text style={styles.disclaimer}>Este comprobante no tiene valor fiscal.</Text>

        </View>
      </Page>
    </Document>
  )
}

let _logoUri: string | null | undefined = undefined

async function getLogoUri(): Promise<string | null> {
  if (_logoUri !== undefined) return _logoUri
  try {
    const sharp = (await import('sharp')).default
    const svgPath = path.join(process.cwd(), 'public/logo-ceprome-white.svg')
    const png = await sharp(svgPath).resize({ height: 88 }).png().toBuffer()
    _logoUri = `data:image/png;base64,${png.toString('base64')}`
  } catch {
    _logoUri = null
  }
  return _logoUri
}

export async function renderComprobante(data: ComprobanteData): Promise<Buffer> {
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const logoUri = await getLogoUri()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const element = React.createElement(ComprobanteDocument, { data, logoUri }) as any
  return renderToBuffer(element) as Promise<Buffer>
}
