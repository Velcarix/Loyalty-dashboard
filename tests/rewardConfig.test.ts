import { describe, expect, it } from 'vitest'
import {
  REWARD_CONFIG_DEFAULTS,
  buildRewardConfig,
  parseRewardConfig,
  validateRewardDraft,
  describeRewardConfig,
  type RewardConfigDraft,
} from '@/lib/rewardConfig'

const draft: RewardConfigDraft = {
  productName: '  Helado grande  ',
  discountPct: '15',
  discountCents: '50',
  takeQty: '3',
  payQty: '2',
  bonusPoints: '20',
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
