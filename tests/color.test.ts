import { describe, expect, it } from 'vitest'
import { getApcaContrast, getColorContrastRatio, getTextColorForBg } from '@/lib/color'

describe('brand color contrast', () => {
  it.each([
    // APCA, no el cociente de WCAG 2: sobre estos rojos y verdes saturados el
    // blanco se lee mejor aunque el cociente clásico prefiera el negro.
    ['#FA0405', '#FFFFFF'],
    ['#16A34A', '#FFFFFF'],
    ['#777777', '#FFFFFF'],
    ['#2563EB', '#FFFFFF'],
    ['#0B132B', '#FFFFFF'],
    ['#000000', '#FFFFFF'],
    ['#FFFFFF', '#000000'],
    ['#FBBF24', '#000000'],
    ['#2DD4BF', '#000000'],
    ['#fff', '#000000'],
    ['invalid', '#FFFFFF'],
  ])('selects the most readable letters for %s', (background, expected) => {
    expect(getTextColorForBg(background)).toBe(expected)
  })

  it('scores white above black on a saturated brand red, which is what WCAG 2 got wrong', () => {
    expect(getApcaContrast('#FFFFFF', '#FA0405')).toBeGreaterThan(getApcaContrast('#000000', '#FA0405'))
    expect(getColorContrastRatio('#000000', '#FA0405')).toBeGreaterThan(getColorContrastRatio('#FFFFFF', '#FA0405'))
  })

  it('reaches its extremes on pure black and white and returns 0 for invalid input', () => {
    expect(getApcaContrast('#000000', '#FFFFFF')).toBeCloseTo(106.0, 0)
    expect(getApcaContrast('#FFFFFF', '#FFFFFF')).toBe(0)
    expect(getApcaContrast('#FFFFFF', 'invalid')).toBe(0)
  })
})
