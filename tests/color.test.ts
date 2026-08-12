import { describe, expect, it } from 'vitest'
import { getTextColorForBg } from '@/lib/color'

describe('brand color contrast', () => {
  it.each([
    ['#2563EB', '#FFFFFF'],
    ['#16A34A', '#000000'],
    ['#FFFFFF', '#000000'],
    ['#0B132B', '#FFFFFF'],
    ['#777777', '#000000'],
    ['#fff', '#000000'],
    ['invalid', '#FFFFFF'],
  ])('selects the strongest contrast for %s', (background, expected) => {
    expect(getTextColorForBg(background)).toBe(expected)
  })
})
