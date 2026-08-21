export type PassCardStyle = 'solid' | 'gradient' | 'banner'
export type PassLogoStyle = 'plate' | 'minimal'
export type PassStampShape = 'circle' | 'rounded'
export type PassTemplate = 'classic' | 'stamps' | 'brand'
export type PassAppearanceZone = 'background' | 'identity' | 'progress' | 'stamps' | 'reward'

export interface LoyaltyPassDesignConfig {
  accentColor: string
  cardStyle: PassCardStyle
  logoStyle: PassLogoStyle
  stampShape: PassStampShape
  /** Fixed card compositions. Individual brand choices remain as overrides. */
  template: PassTemplate
  /** Color used when a completed visit does not have a custom stamp image. */
  stampFilledColor: string
  /** Color for an empty visit slot; it is never used as the only progress signal. */
  stampEmptyColor: string
  /** Surface color of the informative reward block, never the reward state itself. */
  rewardColor: string
}

export interface PassTemplateDefinition {
  id: PassTemplate
  name: string
  description: string
  cardStyle: PassCardStyle
  logoStyle: PassLogoStyle
}

export interface BrandPreset {
  id: string
  name: string
  description: string
  brandColor: string
  accentColor: string
  cardStyle: PassCardStyle
}

export const DEFAULT_PASS_DESIGN: LoyaltyPassDesignConfig = {
  accentColor: '#2DD4BF',
  cardStyle: 'gradient',
  logoStyle: 'plate',
  stampShape: 'circle',
  template: 'classic',
  stampFilledColor: '#FFFFFF',
  stampEmptyColor: '#FFFFFF',
  rewardColor: '#FFFFFF',
}

export const PASS_TEMPLATES: readonly PassTemplateDefinition[] = [
  {
    id: 'classic',
    name: 'Clásica',
    description: 'Contador grande, sobria y premium',
    cardStyle: 'solid',
    logoStyle: 'plate',
  },
  {
    id: 'stamps',
    name: 'Sellos',
    description: 'Visitas visuales con sello personalizado',
    cardStyle: 'gradient',
    logoStyle: 'plate',
  },
  {
    id: 'brand',
    name: 'Cartel de marca',
    description: 'Banner protagonista y progreso compacto',
    cardStyle: 'banner',
    logoStyle: 'minimal',
  },
]

export const BRAND_PRESETS: readonly BrandPreset[] = [
  {
    id: 'copo',
    name: 'Copo azul',
    description: 'Claro y confiable',
    brandColor: '#2563EB',
    accentColor: '#2DD4BF',
    cardStyle: 'gradient',
  },
  {
    id: 'cacao',
    name: 'Cacao',
    description: 'Cálido y artesanal',
    brandColor: '#78350F',
    accentColor: '#F59E0B',
    cardStyle: 'gradient',
  },
  {
    id: 'berry',
    name: 'Frutos rojos',
    description: 'Vibrante y cercano',
    brandColor: '#BE185D',
    accentColor: '#FB7185',
    cardStyle: 'gradient',
  },
  {
    id: 'garden',
    name: 'Jardín',
    description: 'Fresco y natural',
    brandColor: '#166534',
    accentColor: '#84CC16',
    cardStyle: 'solid',
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    description: 'Sobrio y premium',
    brandColor: '#0F172A',
    accentColor: '#818CF8',
    cardStyle: 'solid',
  },
  {
    id: 'sunset',
    name: 'Atardecer',
    description: 'Energético y amable',
    brandColor: '#C2410C',
    accentColor: '#FBBF24',
    cardStyle: 'banner',
  },
]

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value)
}

export function normalizePassDesign(
  design: Partial<LoyaltyPassDesignConfig> | null | undefined,
): LoyaltyPassDesignConfig {
  return {
    accentColor: design?.accentColor && isHexColor(design.accentColor)
      ? design.accentColor
      : DEFAULT_PASS_DESIGN.accentColor,
    cardStyle: design?.cardStyle === 'solid' || design?.cardStyle === 'banner' || design?.cardStyle === 'gradient'
      ? design.cardStyle
      : DEFAULT_PASS_DESIGN.cardStyle,
    logoStyle: design?.logoStyle === 'minimal' || design?.logoStyle === 'plate'
      ? design.logoStyle
      : DEFAULT_PASS_DESIGN.logoStyle,
    stampShape: design?.stampShape === 'rounded' || design?.stampShape === 'circle'
      ? design.stampShape
      : DEFAULT_PASS_DESIGN.stampShape,
    template: design?.template === 'stamps' || design?.template === 'brand' || design?.template === 'classic'
      ? design.template
      : DEFAULT_PASS_DESIGN.template,
    stampFilledColor: design?.stampFilledColor && isHexColor(design.stampFilledColor)
      ? design.stampFilledColor
      : DEFAULT_PASS_DESIGN.stampFilledColor,
    stampEmptyColor: design?.stampEmptyColor && isHexColor(design.stampEmptyColor)
      ? design.stampEmptyColor
      : DEFAULT_PASS_DESIGN.stampEmptyColor,
    rewardColor: design?.rewardColor && isHexColor(design.rewardColor)
      ? design.rewardColor
      : DEFAULT_PASS_DESIGN.rewardColor,
  }
}

/**
 * Applies only a template's composition. Brand colors and per-zone custom
 * choices are intentionally preserved so changing templates is reversible.
 */
export function applyPassTemplate(
  design: Partial<LoyaltyPassDesignConfig> | null | undefined,
  template: PassTemplate,
): LoyaltyPassDesignConfig {
  const current = normalizePassDesign(design)
  const definition = PASS_TEMPLATES.find(item => item.id === template)
  if (!definition) return current

  return {
    ...current,
    template,
    cardStyle: definition.cardStyle,
    logoStyle: definition.logoStyle,
  }
}

export function getBrandPreset(id: string): BrandPreset | undefined {
  return BRAND_PRESETS.find(preset => preset.id === id)
}
