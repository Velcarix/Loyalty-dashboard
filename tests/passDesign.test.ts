import { describe, expect, it } from 'vitest'
import { getTextColorForBg } from '@/lib/color'
import {
  applyPassTemplate,
  BRAND_PRESETS,
  DEFAULT_PASS_DESIGN,
  getBrandPreset,
  isHexColor,
  normalizePassDesign,
  PASS_TEMPLATES,
} from '@/lib/passDesign'

describe('pass-design presets', () => {
  it('publishes unique presets with complete, valid branding colors', () => {
    expect(BRAND_PRESETS.length).toBeGreaterThan(0)
    expect(new Set(BRAND_PRESETS.map(preset => preset.id)).size).toBe(BRAND_PRESETS.length)

    for (const preset of BRAND_PRESETS) {
      expect(preset.name.trim()).not.toBe('')
      expect(preset.description.trim()).not.toBe('')
      expect(isHexColor(preset.brandColor)).toBe(true)
      expect(isHexColor(preset.accentColor)).toBe(true)
      expect(['solid', 'gradient', 'banner']).toContain(preset.cardStyle)
      expect(['#FFFFFF', '#000000']).toContain(getTextColorForBg(preset.brandColor))
      expect(['#FFFFFF', '#000000']).toContain(getTextColorForBg(preset.accentColor))
    }
  })

  it('finds a preset by its stable id and does not invent one for an unknown id', () => {
    const preset = getBrandPreset('copo')

    expect(preset).toMatchObject({
      id: 'copo',
      brandColor: '#2563EB',
      accentColor: '#2DD4BF',
      cardStyle: 'gradient',
    })
    expect(getBrandPreset('no-existe')).toBeUndefined()
    expect(getBrandPreset('🧋')).toBeUndefined()
  })
})

describe('pass-design normalization', () => {
  it.each([null, undefined, {}, { accentColor: '#fff' }, { accentColor: 'red', cardStyle: 'neon' }])(
    'falls back to the safe default for malformed or absent input: %o',
    input => {
      expect(normalizePassDesign(input as never)).toEqual(DEFAULT_PASS_DESIGN)
    },
  )

  it('keeps every supported visual choice and a valid custom accent', () => {
    expect(normalizePassDesign({
      accentColor: '#Aa11Ff',
      cardStyle: 'banner',
      logoStyle: 'minimal',
      stampShape: 'rounded',
    })).toEqual({
      ...DEFAULT_PASS_DESIGN,
      accentColor: '#Aa11Ff',
      cardStyle: 'banner',
      logoStyle: 'minimal',
      stampShape: 'rounded',
    })
  })

  it('keeps a valid custom text color and drops a malformed one so the pass falls back to automatic contrast', () => {
    expect(normalizePassDesign({ textColor: '#101820' }).textColor).toBe('#101820')
    expect(normalizePassDesign({ textColor: 'white' as never }).textColor).toBeUndefined()
    expect(normalizePassDesign({}).textColor).toBeUndefined()
  })

  it('normalizes interactive editor controls independently, keeping valid controls when another zone is invalid', () => {
    expect(normalizePassDesign({
      template: 'stamps',
      accentColor: '#Aa11Ff',
      cardStyle: 'neon',
      logoStyle: 'minimal',
      stampShape: 'rounded',
      stampFilledColor: '#123456',
      stampEmptyColor: 'transparent',
      rewardColor: '#ABCDEF',
    } as never)).toEqual({
      ...DEFAULT_PASS_DESIGN,
      template: 'stamps',
      accentColor: '#Aa11Ff',
      logoStyle: 'minimal',
      stampShape: 'rounded',
      stampFilledColor: '#123456',
      rewardColor: '#ABCDEF',
    })
  })

  it.each([
    ['unknown', 'template'],
    ['#abc', 'stampFilledColor'],
    ['url(javascript:alert(1))', 'stampEmptyColor'],
    ['rgb(1, 2, 3)', 'rewardColor'],
  ])('falls back safely when the editable %s value is malformed', (invalidValue, field) => {
    const design = normalizePassDesign({ [field]: invalidValue })

    expect(design).toEqual(DEFAULT_PASS_DESIGN)
  })

  it('does not persist interactive state or protected QR/operational values from arbitrary input', () => {
    const design = normalizePassDesign({
      template: 'brand',
      selectedZone: 'qr',
      qrColor: '#FFFFFF',
      qrPayload: 'customer-token-must-not-be-stored-as-design',
      visitsTarget: 999,
      accentColor: '#112233',
    } as never)

    expect(design).toMatchObject({ template: 'brand', accentColor: '#112233' })
    expect(design).not.toHaveProperty('selectedZone')
    expect(design).not.toHaveProperty('qrColor')
    expect(design).not.toHaveProperty('qrPayload')
    expect(design).not.toHaveProperty('visitsTarget')
  })

  it.each([
    ['#2563EB', true],
    ['#fff', false],
    ['2563EB', false],
    [' #2563EB', false],
    ['#2563EB ', false],
    ['#GGGGGG', false],
    ['', false],
    [undefined as unknown as string, false],
  ])('strictly validates six-digit hex colors: %p', (input, expected) => {
    expect(isHexColor(input)).toBe(expected)
  })
})

describe('interactive appearance templates', () => {
  it('publishes exactly the three safe, touch-editable layouts', () => {
    expect(PASS_TEMPLATES.map(template => template.id)).toEqual(['classic', 'stamps', 'brand'])
    expect(new Set(PASS_TEMPLATES.map(template => template.id)).size).toBe(PASS_TEMPLATES.length)

    for (const template of PASS_TEMPLATES) {
      expect(template.name.trim()).not.toBe('')
      expect(template.description.trim()).not.toBe('')
    }
  })

  it.each([
    ['classic', 'solid', 'plate'],
    ['stamps', 'gradient', 'plate'],
    ['brand', 'banner', 'minimal'],
  ] as const)('applies the %s template composition without replacing merchant color overrides', (template, cardStyle, logoStyle) => {
    const appearance = applyPassTemplate({
      ...DEFAULT_PASS_DESIGN,
      accentColor: '#112233',
      stampFilledColor: '#445566',
      stampEmptyColor: '#778899',
      rewardColor: '#AABBCC',
    }, template)

    expect(appearance).toMatchObject({
      template,
      cardStyle,
      logoStyle,
      accentColor: '#112233',
      stampFilledColor: '#445566',
      stampEmptyColor: '#778899',
      rewardColor: '#AABBCC',
    })
    expect(appearance.stampShape).toBe(DEFAULT_PASS_DESIGN.stampShape)
  })

  it('uses the safe default template when a legacy or malformed design has no template', () => {
    expect(applyPassTemplate(normalizePassDesign(null), 'classic')).toMatchObject({
      template: 'classic',
      cardStyle: 'solid',
    })
  })
})
