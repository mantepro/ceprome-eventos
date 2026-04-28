import QRCode from 'qrcode'

export async function generateQRBuffer(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })
}

export async function generateQRDataURL(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    errorCorrectionLevel: 'H',
  })
}
