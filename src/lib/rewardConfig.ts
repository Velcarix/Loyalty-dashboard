import type { RewardType } from '@/types/loyalty'

/**
 * `LoyaltyReward.config` — contrato real que lee el backend hoy
 * (`computeRedemptionEffect` en Loyalty-app/backend/src/services/transaction.service.ts):
 * fixed_discount → discountCents; pct_discount → discountPct;
 * free_product/bxgy → productName (+ posProductId, que inyecta el mapeo del
 * POS, no este dashboard); bxgy además → buyQty/getQty; bonus_points →
 * bonusPoints. Cualquier otro campo se guarda pero el backend lo ignora.
 *
 * "Lleva N, paga M" es solo la forma en que este editor presenta bxgy — ver
 * más abajo por qué el dueño ya no puede confundirlo con "compra X, llévate Y
 * gratis además".
 */

export interface RewardConfigDraft {
  productName: string
  // Id del producto del POS vinculado, cuando el dueño lo eligió del catálogo
  // en vez de teclear el nombre a mano — '' = sin ligar (solo productName).
  posProductId: string
  discountPct: string
  discountCents: string
  takeQty: string
  payQty: string
  bonusPoints: string
}

export const REWARD_CONFIG_DEFAULTS: RewardConfigDraft = {
  productName: '',
  posProductId: '',
  discountPct: '',
  discountCents: '',
  takeQty: '2',
  payQty: '1',
  bonusPoints: '',
}

/** Tipos donde el dueño entrega/participa un producto — pueden ligarlo al catálogo del POS. */
export function supportsPosProduct(type: RewardType): boolean {
  return type === 'free_product' || type === 'bxgy'
}

function nonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

function positiveInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function pesosToCents(value: string): number {
  const parsed = Number.parseFloat(value.replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed * 100)
}

/**
 * Normaliza el borrador del editor al `config` que espera el backend.
 *
 * bxgy: el runtime solo entiende "paga buyQty, llévate getQty adicionales
 * gratis" (ticket = buyQty + getQty unidades). Antes el dashboard guardaba
 * "Compra X / Lleva Y" con esos mismos nombres, lo que llevaba a un dueño a
 * teclear "Compra 2 / Lleva 1" pensando en un 2x1 y terminar con 3 unidades
 * en el ticket y solo 1 gratis. Aquí el editor pide "Lleva N, paga M" (el
 * total de unidades y cuántas se cobran) y lo traduce a los mismos campos:
 * buyQty = payQty, getQty = takeQty - payQty. Así "Lleva 2, paga 1" sí
 * produce 2 unidades en el ticket con 1 gratis, sin tocar el backend.
 */
export function buildRewardConfig(type: RewardType, draft: RewardConfigDraft): Record<string, unknown> {
  // posProductId es opcional en el contrato — solo se manda cuando el dueño
  // realmente ligó el premio a un producto del catálogo del POS. Sin POS
  // vinculado (o si lo escribió a mano), el campo se omite por completo en
  // vez de mandar '' — igual que antes de que existiera este selector.
  const posProductId = draft.posProductId.trim() || undefined
  switch (type) {
    case 'free_product':
      return { productName: draft.productName.trim(), ...(posProductId ? { posProductId } : {}) }
    case 'pct_discount':
      return { discountPct: Math.min(100, nonNegativeInt(draft.discountPct, 0)) }
    case 'fixed_discount':
      return { discountCents: pesosToCents(draft.discountCents) }
    case 'bxgy': {
      const takeQty = positiveInt(draft.takeQty, 2)
      const payQty = Math.min(Math.max(nonNegativeInt(draft.payQty, 1), 1), takeQty - 1)
      return {
        productName: draft.productName.trim(), buyQty: payQty, getQty: takeQty - payQty,
        ...(posProductId ? { posProductId } : {}),
      }
    }
    case 'bonus_points':
      return { bonusPoints: nonNegativeInt(draft.bonusPoints, 0) }
    case 'vip_exclusive':
      return {}
  }
}

/** Lee un `config` persistido y arma el borrador del editor. */
export function parseRewardConfig(config: Record<string, unknown> | null | undefined): RewardConfigDraft {
  const c = config ?? {}
  const buyQty = typeof c.buyQty === 'number' && c.buyQty > 0 ? c.buyQty : Number(REWARD_CONFIG_DEFAULTS.payQty)
  const getQty = typeof c.getQty === 'number' && c.getQty >= 0 ? c.getQty : Number(REWARD_CONFIG_DEFAULTS.takeQty) - Number(REWARD_CONFIG_DEFAULTS.payQty)
  return {
    productName: typeof c.productName === 'string' ? c.productName : '',
    posProductId: typeof c.posProductId === 'string' ? c.posProductId : '',
    discountPct: c.discountPct !== undefined && c.discountPct !== null ? String(c.discountPct) : '',
    discountCents: typeof c.discountCents === 'number' && c.discountCents > 0 ? String(c.discountCents / 100) : '',
    takeQty: String(buyQty + getQty),
    payQty: String(buyQty),
    bonusPoints: c.bonusPoints !== undefined && c.bonusPoints !== null ? String(c.bonusPoints) : '',
  }
}

/**
 * Validación previa en el dashboard — no reemplaza la del backend, solo evita
 * mandar un borrador evidentemente inválido (ceros silenciosos, campos vacíos).
 */
export function validateRewardDraft(type: RewardType, draft: RewardConfigDraft): string | null {
  switch (type) {
    case 'free_product':
      return draft.productName.trim() ? null : 'Indica el producto o servicio a entregar.'
    case 'pct_discount': {
      const pct = Number.parseInt(draft.discountPct, 10)
      return Number.isInteger(pct) && pct > 0 && pct <= 100 ? null : 'El porcentaje debe ser un entero entre 1 y 100.'
    }
    case 'fixed_discount':
      return pesosToCents(draft.discountCents) > 0 ? null : 'Indica un monto de descuento mayor a $0.'
    case 'bxgy': {
      if (!draft.productName.trim()) return 'Indica el producto a entregar.'
      const takeQty = Number.parseInt(draft.takeQty, 10)
      const payQty = Number.parseInt(draft.payQty, 10)
      if (!Number.isInteger(takeQty) || takeQty < 2) return '"Lleva" debe ser al menos 2 unidades.'
      if (!Number.isInteger(payQty) || payQty < 1 || payQty >= takeQty) return '"Paga" debe ser al menos 1 y menor a "Lleva".'
      return null
    }
    case 'bonus_points': {
      const bonus = Number.parseInt(draft.bonusPoints, 10)
      return Number.isInteger(bonus) && bonus > 0 ? null : 'Indica una cantidad de puntos bonus mayor a 0.'
    }
    case 'vip_exclusive':
      return null
  }
}

/** Resumen legible para la tarjeta de la lista de premios. */
export function describeRewardConfig(type: RewardType, config: Record<string, unknown> | null | undefined, unitLabel: string): string {
  const draft = parseRewardConfig(config)
  switch (type) {
    case 'free_product':
      return `Gratis: ${draft.productName || '—'}`
    case 'pct_discount':
      return `${draft.discountPct || 0}% de descuento`
    case 'fixed_discount':
      return `$${draft.discountCents || 0} de descuento`
    case 'bxgy':
      return `Lleva ${draft.takeQty}, paga ${draft.payQty} · ${draft.productName || 'producto participante'}`
    case 'bonus_points':
      return `+${draft.bonusPoints || 0} ${unitLabel} bonus`
    case 'vip_exclusive':
      return 'Exclusivo para el nivel configurado'
  }
}
