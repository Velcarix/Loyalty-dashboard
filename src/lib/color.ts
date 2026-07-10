export function getTextColorForBg(hex: string): '#FFFFFF' | '#000000' {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#000000' : '#FFFFFF'
}

export function calcPointsEarned(amountCents: number, config: { minPurchaseCents: number; pointsPerCent: number; maxPointsPerPurchase: number | null }): number {
  if (amountCents < config.minPurchaseCents) return 0
  const earned = Math.floor(amountCents * config.pointsPerCent)
  if (config.maxPointsPerPurchase !== null) return Math.min(earned, config.maxPointsPerPurchase)
  return earned
}

export function formatCurrency(centavos: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 }).format(centavos / 100)
}
