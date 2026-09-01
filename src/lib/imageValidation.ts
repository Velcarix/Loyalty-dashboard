// Mismas reglas que backend/src/services/image-upload.service.ts — se validan
// en el cliente primero para que el usuario vea el error de inmediato, no tras
// subir. Se comparten entre ProgramEditor (crear/editar) y ProgramDetailLayout
// (cambiar el banner sin entrar al editor).
export interface ImageRules {
  maxBytes: number
  formats: string[]
  minWidth?: number
  minHeight?: number
  requireAlpha?: boolean
  aspect?: { width: number; height: number; tolerance: number }
}

export const LOGO_RULES: ImageRules = { maxBytes: 1024 * 1024, formats: ['image/png'], minWidth: 480, minHeight: 150, requireAlpha: true }
export const BANNER_RULES: ImageRules = { maxBytes: 2 * 1024 * 1024, formats: ['image/png', 'image/jpeg'], aspect: { width: 1125, height: 432, tolerance: 0.15 } }
export const STAMP_RULES: ImageRules = { maxBytes: 1024 * 1024, formats: ['image/png', 'image/jpeg'], minWidth: 64, minHeight: 64 }

// Firma binaria real de los primeros bytes — no basta con file.type (lo infiere
// el navegador de la extensión) ni con el nombre del archivo: alguien puede
// renombrar cualquier cosa a "logo.png".
async function detectImageFormat(file: File): Promise<'image/png' | 'image/jpeg' | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (head.length >= 8
    && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47
    && head[4] === 0x0D && head[5] === 0x0A && head[6] === 0x1A && head[7] === 0x0A) {
    return 'image/png'
  }
  if (head.length >= 3 && head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) {
    return 'image/jpeg'
  }
  return null
}

async function readImageInfo(file: File): Promise<{ width: number; height: number; hasAlpha: boolean }> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { width: bitmap.width, height: bitmap.height, hasAlpha: true }
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    let hasAlpha = false
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) { hasAlpha = true; break }
    }
    return { width: bitmap.width, height: bitmap.height, hasAlpha }
  } finally {
    bitmap.close()
  }
}

export async function validateImage(file: File, rules: ImageRules): Promise<string | null> {
  const allowedLabel = rules.formats.map(f => f.replace('image/', '').toUpperCase()).join(' o ')
  const detectedFormat = await detectImageFormat(file)
  if (!detectedFormat) {
    return `El archivo no es un ${allowedLabel} válido — su contenido no coincide con ninguno de esos formatos, aunque el nombre lo diga`
  }
  if (!rules.formats.includes(detectedFormat)) {
    return `El archivo es en realidad ${detectedFormat === 'image/png' ? 'PNG' : 'JPG'}, pero aquí se necesita ${allowedLabel}`
  }
  if (file.size > rules.maxBytes) {
    return `El archivo pesa más de ${(rules.maxBytes / 1024 / 1024).toFixed(0)} MB`
  }
  let info: { width: number; height: number; hasAlpha: boolean }
  try {
    info = await readImageInfo(file)
  } catch {
    return 'No se pudo leer la imagen — intenta con otro archivo'
  }
  if (rules.minWidth && info.width < rules.minWidth) return `Debe medir al menos ${rules.minWidth}px de ancho (subiste ${info.width}px)`
  if (rules.minHeight && info.height < rules.minHeight) return `Debe medir al menos ${rules.minHeight}px de alto (subiste ${info.height}px)`
  if (rules.requireAlpha && !info.hasAlpha) return 'Debe tener transparencia (canal alfa) — el fondo no puede ser sólido'
  if (rules.aspect) {
    const targetRatio = rules.aspect.width / rules.aspect.height
    const actualRatio = info.height > 0 ? info.width / info.height : 0
    if (Math.abs(actualRatio - targetRatio) / targetRatio > rules.aspect.tolerance) {
      return `La proporción debe ser cercana a ${rules.aspect.width}×${rules.aspect.height} (subiste ${info.width}×${info.height})`
    }
  }
  return null
}
