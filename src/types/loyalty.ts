import type { LoyaltyPassDesignConfig } from '@/lib/passDesign'

export type ProgramType = 'points' | 'visits'

export interface LoyaltyBusinessInfo {
  terms?: string
  phone?: string
  address?: string
  website?: string
  socials?: { instagram?: string; facebook?: string }
  /** Visual pass options persisted with the merchant's public business data. */
  design?: LoyaltyPassDesignConfig
}

export interface CustomRegistrationField {
  id: string
  label: string
  required: boolean
}

export interface LoyaltyProgram {
  id: string
  businessId: string
  name: string
  type: ProgramType
  isActive: boolean
  brandColor: string
  logoUrl: string
  bannerUrl: string | null
  programName: string
  description: string
  welcomeMessage: string | null
  saldoLabel: string | null
  businessInfo: LoyaltyBusinessInfo | null
  askBirthday: boolean
  askGender: boolean
  customFields: CustomRegistrationField[] | null
  createdAt: string
  updatedAt: string
}

export interface LoyaltyPointsConfig {
  programId: string
  pointsPerCent: number
  minPurchaseCents: number
  maxPointsPerPurchase: number | null
  expirationDays: number | null
  cashbackEnabled: boolean
  cashbackRateBps: number
  centPerPoint: number
  minPointsToRedeem: number
  allowPartialRedemption: boolean
  maxVisitsPerDay: number
  // Puntos sin POS vinculado: timestamp de cuando el comerciante aceptó el
  // riesgo de fraude (nadie más que el propio empleado valida el monto
  // tecleado). Null si tiene POS vinculado.
  noPosRiskAcknowledgedAt: string | null
}

export interface LoyaltyVisitsConfig {
  programId: string
  visitsTarget: number
  rewardDescription: string
  maxVisitsPerDay: number
  // Formato de progreso en el pass: número simple (3/10) o tarjeta de
  // sellos visual. Con 'stamp', stampImageUrl es la imagen que reemplaza
  // el sello relleno al registrar una visita.
  visualStyle?: 'number' | 'stamp'
  stampImageUrl?: string | null
}

export type RewardType = 'free_product' | 'pct_discount' | 'fixed_discount' | 'bxgy' | 'bonus_points' | 'vip_exclusive'

export interface AudienceFilter {
  segment?: 'active' | 'at_risk' | 'lapsed' | 'vip'
  gender?: 'male' | 'female'
  minAge?: number
  maxAge?: number
  customFieldFilters?: { fieldId: string; value: string }[]
}

export interface LoyaltyReward {
  id: string
  programId: string
  type: RewardType
  name: string
  description: string
  imageUrl?: string | null
  // 0 = gratis para quien califique según `eligibility` (verificado con QR, sin puntos)
  pointsRequired: number
  isActive: boolean
  usageCount: number
  usageLimit: number | null
  perUserLimit: number | null
  minTierId: string | null
  startsAt: string | null
  expiresAt: string | null
  config: Record<string, unknown>
  // Quién puede canjearla — null/ausente = abierta a cualquiera
  eligibility?: AudienceFilter | null
}

export interface LoyaltyCustomer {
  id: string
  programId: string
  name: string
  phone: string
  email: string | null
  // ISO "YYYY-MM-DD" (fecha completa, con año)
  birthdayDate?: string | null
  gender?: string | null
  customFieldValues?: Record<string, string> | null
  pointsBalance: number
  visitsCount: number
  totalEarnedPoints: number
  hasPendingReward: boolean
  pendingRewardDescription: string | null
  segment: 'active' | 'at_risk' | 'lapsed' | 'vip'
  createdAt: string
  lastActivityAt: string | null
}

export type NotificationChannel = 'push' | 'sms' | 'email'
export type NotificationStatus = 'scheduled' | 'sending' | 'sent' | 'failed'

export interface LoyaltyNotification {
  id: string
  programId: string
  trigger: string
  channels: NotificationChannel[]
  title: string
  message: string
  targetSegment: 'active' | 'at_risk' | 'lapsed' | 'vip' | null
  targetFilters: AudienceFilter | null
  targetCustomerIds: string[]
  scheduledFor: string | null
  sentAt: string | null
  status: NotificationStatus
  recipientCount: number
  deliveredCount: number
  createdAt: string
}

export interface LoyaltyTransaction {
  id: string
  type: 'accumulate' | 'redeem' | 'reward_claim' | 'reversal' | 'adjustment'
  cardCustomerId: string
  pointsDelta: number
  visitsDelta: number
  discountCents: number | null
  amountCents: number | null
  cashierId: string
  branchId: string
  verificationMethod: string
  createdAt: string
  customer?: { name: string; phone: string }
}

export interface AnalyticsData {
  totalCustomers: number
  activeCustomers: number
  atRiskCustomers: number
  lapsedCustomers: number
  vipCustomers: number
  newCustomersInPeriod: number
  totalDiscountCents: number
  totalPointsIssued: number
  totalPointsRedeemed: number
}

export interface Anomaly {
  description: string
  count: number
  severity: 'high' | 'medium'
}

export interface MerchantProfile {
  id: string
  email: string
  businessName: string
  vertical: string | null
  phone: string | null
  plan: string
  mostradorSessionSeconds: number
}

export interface MerchantLocation {
  id: string
  name: string
  isActive: boolean
}
