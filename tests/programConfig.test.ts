import { describe, expect, it } from 'vitest'
import {
  buildPointsConfig,
  buildVisitsConfig,
  centsToPesosInput,
  getContrastTextColor,
  type PointsConfigDraft,
  type VisitsConfigDraft,
} from '@/lib/programConfig'

const pointsDraft: PointsConfigDraft = {
  earnRatePesos: '2.5',
  minPurchasePesos: '12.34',
  maxPointsPerPurchase: '500',
  expirationDays: '365',
  centPerPoint: '100',
  minPointsToRedeem: '25',
  allowPartialRedemption: true,
  maxVisitsPerDay: '3',
  noPosRiskAcknowledgedAt: '2026-08-13T20:00:00.000Z',
}

const visitsDraft: VisitsConfigDraft = {
  visitsTarget: '8',
  rewardDescription: '  Caf\u00e9 gratis  ',
  maxVisitsPerDay: '2',
  visualStyle: 'stamp',
}

describe('program configuration API contracts', () => {
  it('emits every backend-required points field with normalized integer values', () => {
    expect(buildPointsConfig(pointsDraft)).toStrictEqual({
      pointsPerCent: 250,
      minPurchaseCents: 1234,
      maxPointsPerPurchase: 500,
      expirationDays: 365,
      cashbackEnabled: false,
      cashbackRateBps: 0,
      centPerPoint: 100,
      minPointsToRedeem: 25,
      allowPartialRedemption: true,
      maxVisitsPerDay: 3,
      noPosRiskAcknowledgedAt: '2026-08-13T20:00:00.000Z',
    })
  })

  it('emits the entire visits contract and leaves the uploaded stamp asset to its endpoint', () => {
    expect(buildVisitsConfig(visitsDraft)).toStrictEqual({
      visitsTarget: 8,
      rewardDescription: 'Caf\u00e9 gratis',
      maxVisitsPerDay: 2,
      visualStyle: 'stamp',
    })
  })

  it('uses safe API defaults for empty, invalid, and boundary point inputs', () => {
    expect(buildPointsConfig({
      ...pointsDraft,
      earnRatePesos: '',
      minPurchasePesos: '-1',
      maxPointsPerPurchase: '',
      expirationDays: '0',
      centPerPoint: '0',
      minPointsToRedeem: 'not-a-number',
      maxVisitsPerDay: '-5',
      noPosRiskAcknowledgedAt: null,
    })).toStrictEqual({
      pointsPerCent: 100,
      minPurchaseCents: 0,
      maxPointsPerPurchase: null,
      expirationDays: null,
      cashbackEnabled: false,
      cashbackRateBps: 0,
      centPerPoint: 100,
      minPointsToRedeem: 10,
      allowPartialRedemption: true,
      maxVisitsPerDay: 1,
      noPosRiskAcknowledgedAt: null,
    })
  })

  it('normalizes visit boundary values without leaking an invalid payload', () => {
    expect(buildVisitsConfig({
      visitsTarget: '0',
      rewardDescription: '  🥳 premio especial  ',
      maxVisitsPerDay: '',
      visualStyle: 'number',
    })).toStrictEqual({
      visitsTarget: 10,
      rewardDescription: '🥳 premio especial',
      maxVisitsPerDay: 1,
      visualStyle: 'number',
    })
  })
})

describe('branding conversion and contrast utilities', () => {
  it.each([
    [100, '1'],
    [1234, '12.34'],
    [0, '0'],
    [null, '1'],
    [undefined, '1'],
    [-1, '1'],
  ])('converts persisted cents into safe editor input: %p', (cents, expected) => {
    expect(centsToPesosInput(cents)).toBe(expected)
  })

  it.each([
    ['#FFFFFF', '#000000'],
    ['#0B132B', '#FFFFFF'],
    ['#16A34A', '#000000'],
    ['#777777', '#000000'],
    ['invalid', '#FFFFFF'],
  ])('selects the strongest accessible text contrast for %s', (background, expected) => {
    expect(getContrastTextColor(background)).toBe(expected)
  })
})
