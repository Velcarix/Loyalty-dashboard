import type { RewardType } from '@/types/loyalty'

/**
 * `LoyaltyReward.config` — contrato real que lee el backend hoy
 * (`computeRedemptionEffect` en Loyalty-app/backend/src/services/transaction.service.ts):
 * fixed_discount → discountCents; pct_discount → discountPct;
 * free_product/bxgy → productName (+ posProductId, que inyecta el mapeo del
 * POS, no este dashboard); bxgy además → buyQty/getQty; bonus_points →
 * bonusPoints. pct_discount/fixed_discount/bxgy aceptan además `scope` (a qué
 * líneas del ticket aplica — ver RewardScope más abajo); el backend lo reenvía
 * al POS en el `effect` del canje. Cualquier otro campo se guarda pero el
 * backend lo ignora.
 *
 * "Lleva N, paga M" es solo la forma en que este editor presenta bxgy — ver
 * más abajo por qué el dueño ya no puede confundirlo con "compra X, llévate Y
 * gratis además".
 */

/**
 * A qué parte del ticket aplica un descuento o un "Lleva N, paga M".
 * - ticket: toda la cuenta (lo que hacían todos los descuentos antes de que
 *   existiera `scope`; un config sin `scope` significa esto).
 * - categories: solo las líneas cuya categoría del POS esté en la lista
 *   (se compara por nombre, sin distinguir mayúsculas).
 * - products: solo esos productos. Cada producto lleva TODOS los ids del
 *   catálogo con ese nombre — en un negocio con varias sucursales el mismo
 *   producto tiene un id distinto por sucursal, y el premio debe aplicar en
 *   cualquiera de ellas.
 */
export type RewardScopeMode = 'ticket' | 'categories' | 'products'

export interface RewardScopeProduct {
  name: string
  posProductIds: string[]
}

export type RewardScope =
  | { appliesTo: 'ticket' }
  | { appliesTo: 'categories'; categories: string[] }
  | { appliesTo: 'products'; products: RewardScopeProduct[] }

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
  scopeMode: RewardScopeMode
  scopeCategories: string[]
  scopeProducts: RewardScopeProduct[]
}

export const REWARD_CONFIG_DEFAULTS: RewardConfigDraft = {
  productName: '',
  posProductId: '',
  discountPct: '',
  discountCents: '',
  takeQty: '2',
  payQty: '1',
  bonusPoints: '',
  scopeMode: 'ticket',
  scopeCategories: [],
  scopeProducts: [],
}

/** Tipos donde el dueño entrega/participa un producto — pueden ligarlo al catálogo del POS. */
export function supportsPosProduct(type: RewardType): boolean {
  return type === 'free_product' || type === 'bxgy'
}

/**
 * Alcances que el dueño puede elegir por tipo. En bxgy "products" es el
 * selector de un solo producto de siempre (productName/posProductId) y
 * "categories" permite "2x1 en todas las bebidas". free_product no tiene
 * alcance: el POS necesita saber exactamente qué producto regalar.
 */
export function scopeModesFor(type: RewardType): RewardScopeMode[] {
  switch (type) {
    case 'pct_discount':
    case 'fixed_discount':
      return ['ticket', 'categories', 'products']
    case 'bxgy':
      return ['products', 'categories']
    default:
      return []
  }
}

/** El modo del borrador si el tipo lo admite; si no, el primero que admite. */
export function effectiveScopeMode(type: RewardType, draft: RewardConfigDraft): RewardScopeMode | null {
  const modes = scopeModesFor(type)
  if (modes.length === 0) return null
  return modes.includes(draft.scopeMode) ? draft.scopeMode : modes[0]
}

/** ¿El editor debe mostrar el selector de un solo producto (free_product, o bxgy por producto)? */
export function showsSingleProductPicker(type: RewardType, draft: RewardConfigDraft): boolean {
  return type === 'free_product' || (type === 'bxgy' && effectiveScopeMode(type, draft) === 'products')
}

function cleanList(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    const key = trimmed.toLowerCase()
    if (trimmed && !seen.has(key)) {
      seen.add(key)
      out.push(trimmed)
    }
  }
  return out
}

function buildScope(type: RewardType, draft: RewardConfigDraft): RewardScope | undefined {
  const mode = effectiveScopeMode(type, draft)
  if (mode === 'categories') return { appliesTo: 'categories', categories: cleanList(draft.scopeCategories) }
  if (mode === 'products' && type !== 'bxgy') {
    return {
      appliesTo: 'products',
      products: draft.scopeProducts
        .filter(p => p.name.trim())
        .map(p => ({ name: p.name.trim(), posProductIds: cleanList(p.posProductIds) })),
    }
  }
  // ticket (o bxgy por producto, que sigue usando productName/posProductId):
  // se omite `scope` — igual que un config de antes de que existiera.
  return undefined
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
    case 'pct_discount': {
      const scope = buildScope(type, draft)
      return { discountPct: Math.min(100, nonNegativeInt(draft.discountPct, 0)), ...(scope ? { scope } : {}) }
    }
    case 'fixed_discount': {
      const scope = buildScope(type, draft)
      return { discountCents: pesosToCents(draft.discountCents), ...(scope ? { scope } : {}) }
    }
    case 'bxgy': {
      const takeQty = positiveInt(draft.takeQty, 2)
      const payQty = Math.min(Math.max(nonNegativeInt(draft.payQty, 1), 1), takeQty - 1)
      const scope = buildScope(type, draft)
      // Por categoría no hay un producto único: se omiten productName y
      // posProductId (el backend usa el nombre del premio como etiqueta).
      if (scope) return { buyQty: payQty, getQty: takeQty - payQty, scope }
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
function parseScope(raw: unknown): Pick<RewardConfigDraft, 'scopeMode' | 'scopeCategories' | 'scopeProducts'> {
  const none: Pick<RewardConfigDraft, 'scopeMode' | 'scopeCategories' | 'scopeProducts'> = {
    scopeMode: REWARD_CONFIG_DEFAULTS.scopeMode, scopeCategories: [], scopeProducts: [],
  }
  if (!raw || typeof raw !== 'object') return none
  const scope = raw as Record<string, unknown>
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  if (scope.appliesTo === 'categories') {
    return { ...none, scopeMode: 'categories', scopeCategories: strings(scope.categories) }
  }
  if (scope.appliesTo === 'products') {
    const products = Array.isArray(scope.products) ? scope.products : []
    return {
      ...none,
      scopeMode: 'products',
      scopeProducts: products
        .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object' && typeof (p as Record<string, unknown>).name === 'string')
        .map(p => ({ name: p.name as string, posProductIds: strings(p.posProductIds) })),
    }
  }
  return none
}

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
    ...parseScope(c.scope),
  }
}

/**
 * Validación previa en el dashboard — no reemplaza la del backend, solo evita
 * mandar un borrador evidentemente inválido (ceros silenciosos, campos vacíos).
 */
function validateScope(type: RewardType, draft: RewardConfigDraft): string | null {
  const mode = effectiveScopeMode(type, draft)
  if (mode === 'categories' && cleanList(draft.scopeCategories).length === 0) {
    return 'Elige al menos una categoría a la que aplica.'
  }
  if (mode === 'products' && type !== 'bxgy' && !draft.scopeProducts.some(p => p.name.trim())) {
    return 'Elige al menos un producto al que aplica.'
  }
  return null
}

export function validateRewardDraft(type: RewardType, draft: RewardConfigDraft): string | null {
  switch (type) {
    case 'free_product':
      return draft.productName.trim() ? null : 'Indica el producto o servicio a entregar.'
    case 'pct_discount': {
      const pct = Number.parseInt(draft.discountPct, 10)
      if (!(Number.isInteger(pct) && pct > 0 && pct <= 100)) return 'El porcentaje debe ser un entero entre 1 y 100.'
      return validateScope(type, draft)
    }
    case 'fixed_discount':
      if (pesosToCents(draft.discountCents) <= 0) return 'Indica un monto de descuento mayor a $0.'
      return validateScope(type, draft)
    case 'bxgy': {
      const scopeError = validateScope(type, draft)
      if (scopeError) return scopeError
      if (effectiveScopeMode(type, draft) === 'products' && !draft.productName.trim()) return 'Indica el producto a entregar.'
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
export function describeRewardConfig(
  type: RewardType,
  config: Record<string, unknown> | null | undefined,
  unitLabel: string,
  // Clave de categoría del POS ("ICE_CREAM") → nombre visible ("Helados").
  categoryLabel: (key: string) => string = key => key,
): string {
  const draft = parseRewardConfig(config)
  const scopeText = draft.scopeMode === 'categories'
    ? draft.scopeCategories.map(categoryLabel).join(', ')
    : draft.scopeMode === 'products' ? draft.scopeProducts.map(p => p.name).join(', ') : ''
  switch (type) {
    case 'free_product':
      return `Gratis: ${draft.productName || '—'}`
    case 'pct_discount':
      return `${draft.discountPct || 0}% de descuento${scopeText ? ` en ${scopeText}` : ''}`
    case 'fixed_discount':
      return `$${draft.discountCents || 0} de descuento${scopeText ? ` en ${scopeText}` : ''}`
    case 'bxgy':
      if (draft.scopeMode === 'categories') return `Lleva ${draft.takeQty}, paga ${draft.payQty} · categorías: ${scopeText || '—'}`
      return `Lleva ${draft.takeQty}, paga ${draft.payQty} · ${draft.productName || 'producto participante'}`
    case 'bonus_points':
      return `+${draft.bonusPoints || 0} ${unitLabel} bonus`
    case 'vip_exclusive':
      return 'Exclusivo para el nivel configurado'
  }
}
