import type { LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

export interface PointsConfigDraft {
  earnRatePesos: string
  minPurchasePesos: string
  maxPointsPerPurchase: string
  expirationDays: string
  centPerPoint: string
  minPointsToRedeem: string
  allowPartialRedemption: boolean
  maxVisitsPerDay: string
  noPosRiskAcknowledgedAt: string | null
}

export interface VisitsConfigDraft {
  visitsTarget: string
  rewardDescription: string
  maxVisitsPerDay: string
  visualStyle: 'number' | 'stamp'
}

type PointsConfigPayload = Omit<LoyaltyPointsConfig, 'programId'>
type VisitsConfigPayload = Omit<LoyaltyVisitsConfig, 'programId'>

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function optionalPositiveInteger(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function pesosToCents(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Math.max(0, Math.round(parsed * 100))
}

/**
 * Normalizes the editor draft to the complete API contract. `pointsPerCent`
 * is a historical backend name: it represents cents spent for one point.
 */
export function buildPointsConfig(draft: PointsConfigDraft): PointsConfigPayload {
  return {
    pointsPerCent: Math.max(1, pesosToCents(draft.earnRatePesos, 100)),
    minPurchaseCents: pesosToCents(draft.minPurchasePesos, 0),
    maxPointsPerPurchase: optionalPositiveInteger(draft.maxPointsPerPurchase),
    expirationDays: optionalPositiveInteger(draft.expirationDays),
    cashbackEnabled: false,
    cashbackRateBps: 0,
    centPerPoint: positiveInteger(draft.centPerPoint, 100),
    minPointsToRedeem: positiveInteger(draft.minPointsToRedeem, 10),
    allowPartialRedemption: draft.allowPartialRedemption,
    maxVisitsPerDay: positiveInteger(draft.maxVisitsPerDay, 1),
    noPosRiskAcknowledgedAt: draft.noPosRiskAcknowledgedAt,
  }
}

export function buildVisitsConfig(draft: VisitsConfigDraft): VisitsConfigPayload {
  return {
    visitsTarget: positiveInteger(draft.visitsTarget, 10),
    rewardDescription: draft.rewardDescription.trim(),
    maxVisitsPerDay: positiveInteger(draft.maxVisitsPerDay, 1),
    visualStyle: draft.visualStyle,
  }
}

export function centsToPesosInput(value: number | null | undefined, fallback = '1'): string {
  if (value === null || value === undefined || value < 0) return fallback
  return (value / 100).toString()
}

export function getContrastTextColor(hex: string): '#000000' | '#FFFFFF' {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#FFFFFF'
  const channels = [0, 2, 4].map(index => Number.parseInt(normalized.slice(index, index + 2), 16) / 255)
  const [red, green, blue] = channels.map(channel => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ))
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  const whiteContrast = 1.05 / (luminance + 0.05)
  const blackContrast = (luminance + 0.05) / 0.05
  return whiteContrast >= 4.5 && whiteContrast >= blackContrast ? '#FFFFFF' : '#000000'
}
