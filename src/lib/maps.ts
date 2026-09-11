export interface Coordinates {
  latitude: number
  longitude: number
}

function decodeSafe(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toCoordinates(lat: string, lng: string): Coordinates | null {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null
  return { latitude, longitude }
}

const NUMBER = '(-?\\d+(?:\\.\\d+)?)'

/**
 * Coordenadas desde un enlace de Google Maps o texto "lat, lng". Evita pagar
 * una API de geocodificación: el merchant pega el enlace de su propio negocio.
 * Prioridad: !3d/!4d (el pin exacto del lugar) > ?q= / ?ll= > @lat,lng (el
 * centro de la cámara, puede estar corrido) > texto plano.
 */
export function parseCoordinates(input: string): Coordinates | null {
  const text = decodeSafe(input.trim())
  if (!text) return null

  const patterns = [
    new RegExp(`!3d${NUMBER}!4d${NUMBER}`),
    new RegExp(`[?&](?:q|query|ll|destination)=${NUMBER},\\s*${NUMBER}`, 'i'),
    new RegExp(`@${NUMBER},${NUMBER}`),
    new RegExp(`^${NUMBER}\\s*,\\s*${NUMBER}$`),
  ]
  for (const pattern of patterns) {
    const match = pattern.exec(text)
    if (match) return toCoordinates(match[1], match[2])
  }
  return null
}

/** Los enlaces cortos (maps.app.goo.gl) no traen coordenadas hasta abrirlos. */
export function isShortMapsLink(input: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input)
}

export function formatCoordinates({ latitude, longitude }: Coordinates): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}
