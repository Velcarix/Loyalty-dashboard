// Contraste percibido (APCA, el modelo del borrador WCAG 3) en lugar del
// cociente de luminancias de WCAG 2. El cociente clásico subestima el blanco
// sobre colores saturados: sobre un rojo de marca como #FA0405 daba negro
// (5.08 vs 4.13) aunque el blanco se lee claramente mejor. APCA compara la
// misma pareja como Lc 70.9 (blanco) contra Lc 38.7 (negro) y elige blanco.
const APCA = {
  // Coeficientes de luminancia y exponentes de la curva sRGB simple de APCA.
  red: 0.2126729,
  green: 0.7151522,
  blue: 0.0721750,
  trc: 2.4,
  // Exponentes por polaridad: texto oscuro sobre fondo claro (norm) y texto
  // claro sobre fondo oscuro (rev).
  normBackground: 0.56,
  normText: 0.57,
  revText: 0.62,
  revBackground: 0.65,
  // Compensa que los negros muy profundos se perciben más claros de lo que
  // mide el sensor.
  blackThreshold: 0.022,
  blackClamp: 1.414,
  scale: 1.14,
  offset: 0.027,
  // Por debajo de este contraste el resultado se considera nulo, no "poco".
  lowClip: 0.1,
  minDelta: 0.0005,
} as const

function parseHex(hex: string): string | null {
  const normalized = hex.trim().replace(/^#/, '')
  const fullHex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized
  return /^[0-9a-f]{6}$/i.test(fullHex) ? fullHex : null
}

/** Luminancia de pantalla de APCA, con el ajuste para negros profundos. */
function getScreenLuminance(fullHex: string): number {
  const [r, g, b] = [0, 2, 4].map(index => (parseInt(fullHex.slice(index, index + 2), 16) / 255) ** APCA.trc)
  const luminance = APCA.red * r + APCA.green * g + APCA.blue * b
  return luminance < APCA.blackThreshold
    ? luminance + (APCA.blackThreshold - luminance) ** APCA.blackClamp
    : luminance
}

/**
 * Contraste APCA (Lc) del texto sobre el fondo. Devuelve la magnitud: 0 es
 * ilegible y ~106 es el máximo (negro sobre blanco).
 */
export function getApcaContrast(textHex: string, backgroundHex: string): number {
  const text = parseHex(textHex)
  const background = parseHex(backgroundHex)
  if (!text || !background) return 0

  const textLuminance = getScreenLuminance(text)
  const backgroundLuminance = getScreenLuminance(background)
  if (Math.abs(backgroundLuminance - textLuminance) < APCA.minDelta) return 0

  const isDarkTextOnLightBackground = backgroundLuminance > textLuminance
  const contrast = isDarkTextOnLightBackground
    ? (backgroundLuminance ** APCA.normBackground - textLuminance ** APCA.normText) * APCA.scale
    : (textLuminance ** APCA.revText - backgroundLuminance ** APCA.revBackground) * APCA.scale

  return contrast < APCA.lowClip ? 0 : (contrast - APCA.offset) * 100
}

/**
 * Blanco o negro, el que se lea mejor sobre `hex`. Es la única forma de elegir
 * el color de las letras de la tarjeta: no hay ajuste manual.
 */
export function getTextColorForBg(hex: string): '#FFFFFF' | '#000000' {
  if (!parseHex(hex)) return '#FFFFFF'
  return getApcaContrast('#FFFFFF', hex) >= getApcaContrast('#000000', hex) ? '#FFFFFF' : '#000000'
}

function getRelativeLuminance(hex: string): number | null {
  const fullHex = parseHex(hex)
  if (!fullHex) return null

  const [r, g, b] = [0, 2, 4]
    .map(index => parseInt(fullHex.slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio for two hexadecimal colours, or 1 for invalid input. */
export function getColorContrastRatio(first: string, second: string): number {
  const firstLuminance = getRelativeLuminance(first)
  const secondLuminance = getRelativeLuminance(second)
  if (firstLuminance === null || secondLuminance === null) return 1

  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05)
}

export function calcPointsEarned(amountCents: number, config: { minPurchaseCents: number; pointsPerCent: number; maxPointsPerPurchase: number | null }): number {
  if (amountCents < config.minPurchaseCents) return 0
  // `pointsPerCent` is the legacy API name for cents required to earn one point.
  const earned = Math.floor(amountCents / config.pointsPerCent)
  if (config.maxPointsPerPurchase !== null) return Math.min(earned, config.maxPointsPerPurchase)
  return earned
}

export function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(centavos / 100)
}
