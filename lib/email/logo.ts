import path from 'path'

let _logoDataUri: string | null | undefined = undefined

export async function getEmailLogoUri(): Promise<string | null> {
  if (_logoDataUri !== undefined) return _logoDataUri
  try {
    const sharp = (await import('sharp')).default
    const svgPath = path.join(process.cwd(), 'public/logo-ceprome-white.svg')
    const png = await sharp(svgPath).resize({ height: 88 }).png().toBuffer()
    _logoDataUri = `data:image/png;base64,${png.toString('base64')}`
  } catch {
    _logoDataUri = null
  }
  return _logoDataUri
}
