import { describe, expect, it } from 'vitest'
import {
  REWARD_CONFIG_DEFAULTS,
  buildRewardConfig,
  parseRewardConfig,
  validateRewardDraft,
  describeRewardConfig,
  supportsPosProduct,
  scopeModesFor,
  showsSingleProductPicker,
  type RewardConfigDraft,
} from '@/lib/rewardConfig'

const draft: RewardConfigDraft = {
  productName: '  Helado grande  ',
  posProductId: '',
  discountPct: '15',
  discountCents: '50',
  takeQty: '3',
  payQty: '2',
  bonusPoints: '20',
  scopeMode: 'ticket',
  scopeCategories: [],
  scopeProducts: [],
}

describe('buildRewardConfig', () => {
  it('builds a free_product config with just the trimmed product name (matches computeRedemptionEffect)', () => {
    expect(buildRewardConfig('free_product', draft)).toStrictEqual({ productName: 'Helado grande' })
  })

  it('builds a pct_discount config with a clamped integer percentage', () => {
    expect(buildRewardConfig('pct_discount', { ...draft, discountPct: '150' })).toStrictEqual({ discountPct: 100 })
  })

  it('builds a fixed_discount config with integer cents', () => {
    expect(buildRewardConfig('fixed_discount', { ...draft, discountCents: '49.9' })).toStrictEqual({ discountCents: 4990 })
  })

  it('translates "lleva N, paga M" into the backend\'s buyQty/getQty (buyQty=paid, getQty=free, ticket=buyQty+getQty)', () => {
    // Lleva 3, paga 2 → paga 2 (buyQty), 1 gratis (getQty) → ticket de 3 unidades, 1 gratis.
    expect(buildRewardConfig('bxgy', draft)).toStrictEqual({ productName: 'Helado grande', buyQty: 2, getQty: 1 })
  })

  it('reproduces a real 2x1 (lleva 2, paga 1) as buyQty=1, getQty=1 — not 3 units for 1 free like the old "Compra 2/Lleva 1" bug', () => {
    expect(buildRewardConfig('bxgy', { ...draft, takeQty: '2', payQty: '1' })).toStrictEqual({ productName: 'Helado grande', buyQty: 1, getQty: 1 })
  })

  it('never lets payQty reach or exceed takeQty', () => {
    expect(buildRewardConfig('bxgy', { ...draft, takeQty: '2', payQty: '5' })).toStrictEqual({ productName: 'Helado grande', buyQty: 1, getQty: 1 })
  })

  it('builds a bonus_points config', () => {
    expect(buildRewardConfig('bonus_points', draft)).toStrictEqual({ bonusPoints: 20 })
  })

  it('builds an empty vip_exclusive config', () => {
    expect(buildRewardConfig('vip_exclusive', draft)).toStrictEqual({})
  })

  it('defaults an invalid discount percentage to zero instead of leaking NaN', () => {
    expect(buildRewardConfig('pct_discount', { ...draft, discountPct: 'abc' })).toStrictEqual({ discountPct: 0 })
  })

  it('includes posProductId for free_product when the owner picked it from the POS catalog', () => {
    expect(buildRewardConfig('free_product', { ...draft, posProductId: 'prod-123' }))
      .toStrictEqual({ productName: 'Helado grande', posProductId: 'prod-123' })
  })

  it('includes posProductId for bxgy the same way', () => {
    expect(buildRewardConfig('bxgy', { ...draft, posProductId: 'prod-123' }))
      .toStrictEqual({ productName: 'Helado grande', buyQty: 2, getQty: 1, posProductId: 'prod-123' })
  })

  it('omits posProductId entirely when the owner typed the product by hand', () => {
    expect(buildRewardConfig('free_product', draft)).not.toHaveProperty('posProductId')
  })
})

describe('parseRewardConfig', () => {
  it('round-trips a persisted bxgy config (buyQty/getQty) back into "lleva/paga" draft strings', () => {
    const config = buildRewardConfig('bxgy', { ...draft, takeQty: '3', payQty: '2' })
    expect(parseRewardConfig(config)).toStrictEqual({
      ...REWARD_CONFIG_DEFAULTS,
      productName: 'Helado grande',
      takeQty: '3',
      payQty: '2',
    })
  })

  it('reinterprets an old "Compra 2 / Lleva 1" config (buyQty=2, getQty=1) as its real ticket math: lleva 3, paga 2', () => {
    expect(parseRewardConfig({ productName: 'Café', buyQty: 2, getQty: 1 })).toStrictEqual({
      ...REWARD_CONFIG_DEFAULTS,
      productName: 'Café',
      takeQty: '3',
      payQty: '2',
    })
  })

  it('falls back to safe defaults for a null or unrelated config', () => {
    expect(parseRewardConfig(null)).toStrictEqual(REWARD_CONFIG_DEFAULTS)
    expect(parseRewardConfig({ productName: 'Café' })).toStrictEqual({ ...REWARD_CONFIG_DEFAULTS, productName: 'Café' })
  })

  it('reads back a persisted posProductId', () => {
    expect(parseRewardConfig({ productName: 'Café', posProductId: 'prod-123' })).toStrictEqual({
      ...REWARD_CONFIG_DEFAULTS, productName: 'Café', posProductId: 'prod-123',
    })
  })
})

describe('supportsPosProduct', () => {
  it.each([
    ['free_product', true],
    ['bxgy', true],
    ['pct_discount', false],
    ['fixed_discount', false],
    ['bonus_points', false],
    ['vip_exclusive', false],
  ] as const)('%s → %s', (type, expected) => {
    expect(supportsPosProduct(type)).toBe(expected)
  })
})

describe('validateRewardDraft', () => {
  it('rejects a free_product without a product name', () => {
    expect(validateRewardDraft('free_product', { ...draft, productName: '  ' })).toMatch(/producto/i)
  })

  it('accepts a valid free_product draft', () => {
    expect(validateRewardDraft('free_product', draft)).toBeNull()
  })

  it('rejects a percentage outside 1-100', () => {
    expect(validateRewardDraft('pct_discount', { ...draft, discountPct: '0' })).toMatch(/porcentaje/i)
    expect(validateRewardDraft('pct_discount', { ...draft, discountPct: '101' })).toMatch(/porcentaje/i)
  })

  it('rejects a fixed discount of zero', () => {
    expect(validateRewardDraft('fixed_discount', { ...draft, discountCents: '0' })).toMatch(/monto/i)
  })

  it('rejects bxgy when payQty is not strictly less than takeQty', () => {
    expect(validateRewardDraft('bxgy', { ...draft, takeQty: '2', payQty: '2' })).toMatch(/paga/i)
  })

  it('rejects bxgy when payQty is zero (must pay for at least one unit)', () => {
    expect(validateRewardDraft('bxgy', { ...draft, takeQty: '2', payQty: '0' })).toMatch(/paga/i)
  })

  it('rejects bxgy with takeQty below 2', () => {
    expect(validateRewardDraft('bxgy', { ...draft, takeQty: '1', payQty: '1' })).toMatch(/lleva/i)
  })

  it('accepts a valid bxgy draft', () => {
    expect(validateRewardDraft('bxgy', draft)).toBeNull()
  })

  it('rejects bonus_points at zero', () => {
    expect(validateRewardDraft('bonus_points', { ...draft, bonusPoints: '0' })).toMatch(/puntos bonus/i)
  })

  it('always accepts vip_exclusive', () => {
    expect(validateRewardDraft('vip_exclusive', draft)).toBeNull()
  })
})

describe('describeRewardConfig', () => {
  it('summarizes each reward type in plain Spanish', () => {
    expect(describeRewardConfig('free_product', { productName: 'Café' }, 'visitas')).toBe('Gratis: Café')
    expect(describeRewardConfig('pct_discount', { discountPct: 15 }, 'visitas')).toBe('15% de descuento')
    expect(describeRewardConfig('fixed_discount', { discountCents: 5000 }, 'visitas')).toBe('$50 de descuento')
    expect(describeRewardConfig('bxgy', { productName: 'Bebidas', buyQty: 1, getQty: 1 }, 'visitas')).toBe('Lleva 2, paga 1 · Bebidas')
    expect(describeRewardConfig('bonus_points', { bonusPoints: 20 }, 'puntos')).toBe('+20 puntos bonus')
    expect(describeRewardConfig('vip_exclusive', null, 'visitas')).toBe('Exclusivo para el nivel configurado')
  })
})

describe('reward scope (a qué parte del ticket aplica)', () => {
  it('omits scope for a whole-ticket discount — same config as before scope existed', () => {
    expect(buildRewardConfig('pct_discount', draft)).toStrictEqual({ discountPct: 15 })
    expect(buildRewardConfig('fixed_discount', draft)).toStrictEqual({ discountCents: 5000 })
  })

  it('scopes a % discount to categories, trimming and de-duplicating names', () => {
    const config = buildRewardConfig('pct_discount', {
      ...draft, scopeMode: 'categories', scopeCategories: [' Bebidas ', 'bebidas', 'Postres'],
    })
    expect(config).toStrictEqual({ discountPct: 15, scope: { appliesTo: 'categories', categories: ['Bebidas', 'Postres'] } })
  })

  it('scopes a fixed discount to specific products with every POS id for that name', () => {
    const config = buildRewardConfig('fixed_discount', {
      ...draft, scopeMode: 'products', scopeProducts: [{ name: 'Café americano', posProductIds: ['p1', 'p7'] }],
    })
    expect(config).toStrictEqual({
      discountCents: 5000,
      scope: { appliesTo: 'products', products: [{ name: 'Café americano', posProductIds: ['p1', 'p7'] }] },
    })
  })

  it('builds a bxgy by category without a single productName/posProductId', () => {
    const config = buildRewardConfig('bxgy', {
      ...draft, posProductId: 'prod-1', takeQty: '2', payQty: '1', scopeMode: 'categories', scopeCategories: ['Bebidas'],
    })
    expect(config).toStrictEqual({ buyQty: 1, getQty: 1, scope: { appliesTo: 'categories', categories: ['Bebidas'] } })
  })

  it('keeps bxgy by product exactly as before (no scope field)', () => {
    expect(buildRewardConfig('bxgy', { ...draft, scopeMode: 'products' })).toStrictEqual({ productName: 'Helado grande', buyQty: 2, getQty: 1 })
  })

  it('free_product: sin opciones sigue siendo el producto único de siempre', () => {
    expect(buildRewardConfig('free_product', { ...draft, scopeMode: 'products' })).toStrictEqual({ productName: 'Helado grande' })
  })

  it('free_product: varias opciones (el cliente elige una) o una categoría', () => {
    const options = [{ name: 'Cono', posProductIds: ['p1'] }, { name: 'Vaso', posProductIds: ['p2'] }]
    expect(buildRewardConfig('free_product', { ...draft, scopeMode: 'products', scopeProducts: options }))
      .toStrictEqual({ productName: 'Cono / Vaso', scope: { appliesTo: 'products', products: options } })
    expect(buildRewardConfig('free_product', { ...draft, scopeMode: 'categories', scopeCategories: ['Helados'] }))
      .toStrictEqual({ productName: 'Helado grande', scope: { appliesTo: 'categories', categories: ['Helados'] } })
  })

  it('falls back to the first allowed mode when the draft mode does not apply to the type', () => {
    // El borrador arranca en "ticket"; bxgy no lo admite → producto único.
    expect(showsSingleProductPicker('bxgy', draft)).toBe(true)
    expect(showsSingleProductPicker('bxgy', { ...draft, scopeMode: 'categories' })).toBe(false)
    expect(showsSingleProductPicker('free_product', draft)).toBe(true)
    expect(showsSingleProductPicker('pct_discount', draft)).toBe(false)
  })

  it('offers scope modes only where the POS can honor them', () => {
    expect(scopeModesFor('pct_discount')).toStrictEqual(['ticket', 'categories', 'products'])
    expect(scopeModesFor('fixed_discount')).toStrictEqual(['ticket', 'categories', 'products'])
    expect(scopeModesFor('bxgy')).toStrictEqual(['products', 'categories'])
    expect(scopeModesFor('free_product')).toStrictEqual(['products', 'categories'])
  })

  it('round-trips a scoped config through parseRewardConfig', () => {
    const categories = buildRewardConfig('pct_discount', { ...draft, scopeMode: 'categories', scopeCategories: ['Bebidas'] })
    expect(parseRewardConfig(categories)).toMatchObject({ scopeMode: 'categories', scopeCategories: ['Bebidas'], scopeProducts: [] })
    const products = buildRewardConfig('fixed_discount', {
      ...draft, scopeMode: 'products', scopeProducts: [{ name: 'Café', posProductIds: ['p1'] }],
    })
    expect(parseRewardConfig(products)).toMatchObject({ scopeMode: 'products', scopeProducts: [{ name: 'Café', posProductIds: ['p1'] }] })
  })

  it('ignores a malformed scope instead of crashing', () => {
    expect(parseRewardConfig({ discountPct: 10, scope: 'bebidas' })).toMatchObject({ scopeMode: 'ticket', scopeCategories: [] })
    expect(parseRewardConfig({ discountPct: 10, scope: { appliesTo: 'products', products: [null, { name: 1 }] } }))
      .toMatchObject({ scopeMode: 'products', scopeProducts: [] })
  })

  it('requires at least one category or product when the discount is scoped', () => {
    expect(validateRewardDraft('pct_discount', { ...draft, scopeMode: 'categories' })).toMatch(/categoría/i)
    expect(validateRewardDraft('fixed_discount', { ...draft, scopeMode: 'products' })).toMatch(/producto/i)
    expect(validateRewardDraft('bxgy', { ...draft, scopeMode: 'categories', productName: '' })).toMatch(/categoría/i)
    expect(validateRewardDraft('bxgy', { ...draft, scopeMode: 'categories', scopeCategories: ['Bebidas'], productName: '' })).toBeNull()
  })

  it('mentions the scope in the list summary', () => {
    expect(describeRewardConfig('pct_discount', { discountPct: 15, scope: { appliesTo: 'categories', categories: ['Bebidas', 'Postres'] } }, 'visitas'))
      .toBe('15% de descuento en Bebidas, Postres')
    expect(describeRewardConfig('fixed_discount', { discountCents: 5000, scope: { appliesTo: 'products', products: [{ name: 'Café', posProductIds: [] }] } }, 'visitas'))
      .toBe('$50 de descuento en Café')
    expect(describeRewardConfig('bxgy', { buyQty: 1, getQty: 1, scope: { appliesTo: 'categories', categories: ['Bebidas'] } }, 'visitas'))
      .toBe('Lleva 2, paga 1 · categorías: Bebidas')
  })
})
