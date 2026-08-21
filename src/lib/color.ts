export function getTextColorForBg(hex: string): '#FFFFFF' | '#000000' {
  const normalized = hex.trim().replace(/^#/, '')
  const fullHex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(fullHex)) return '#FFFFFF'

  const channels = [0, 2, 4].map(index => parseInt(fullHex.slice(index, index + 2), 16) / 255)
  const [r, g, b] = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  const backgroundLuminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const whiteContrast = 1.05 / (backgroundLuminance + 0.05)
  const blackContrast = (backgroundLuminance + 0.05) / 0.05
  return whiteContrast >= 4.5 && whiteContrast >= blackContrast ? '#FFFFFF' : '#000000'
}

function getRelativeLuminance(hex: string): number | null {
  const normalized = hex.trim().replace(/^#/, '')
  const fullHex = normalized.length === 3
    ? normalized.split('').map(char => char + char).join('')
    : normalized
  if (!/^[0-9a-f]{6}$/i.test(fullHex)) return null

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
