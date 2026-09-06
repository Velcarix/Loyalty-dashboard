import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletPassPreview } from '@/components/WalletPassPreview'
import { DEFAULT_PASS_DESIGN } from '@/lib/passDesign'

const mountedRoots: Root[] = []

function renderEditablePreview(
  selectedZone?: 'background' | 'identity' | 'progress' | 'stamps' | 'reward',
  configOverrides: Partial<{ stampImageUrl: string; stampEmptyImageUrl: string }> = {},
) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  const onZoneSelect = vi.fn()

  act(() => {
    root.render(
      <WalletPassPreview
        editable
        selectedZone={selectedZone}
        onZoneSelect={onZoneSelect}
        program={{
          type: 'visits',
          brandColor: '#4C1D95',
          programName: 'Gelato Rewards',
          description: 'Acumula visitas para un helado gratis',
          logoUrl: 'https://cdn.example.test/logo.png',
          businessInfo: {
            design: {
              template: 'stamps',
              accentColor: '#EC4899',
              cardStyle: 'gradient',
              logoStyle: 'plate',
              stampShape: 'rounded',
              stampFilledColor: '#FDF2F8',
              stampEmptyColor: '#F9A8D4',
              rewardColor: '#FFFFFF',
              showMemberName: true,
              terminology: {},
            },
          },
        }}
        config={{
          visitsTarget: 7,
          rewardDescription: 'Helado gratis',
          visualStyle: 'stamp',
          stampImageUrl: 'https://cdn.example.test/stamp.png',
          ...configOverrides,
        }}
      />,
    )
  })

  return { container, onZoneSelect }
}

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.replaceChildren()
})

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

describe('WalletPassPreview direct-manipulation editor', () => {
  it('exposes every configurable visual zone with an accessible edit control', () => {
    const { container } = renderEditablePreview()

    for (const label of [
      'Editar fondo y colores',
      'Editar logo y encabezado',
      'Editar contador y etiqueta',
      'Editar forma y color de sellos',
      'Editar bloque de premio',
    ]) {
      expect(container.querySelector(`button[aria-label="${label}"]`)).not.toBeNull()
    }
  })

  it.each([
    ['Editar fondo y colores', 'background'],
    ['Editar logo y encabezado', 'identity'],
    ['Editar contador y etiqueta', 'progress'],
    ['Editar forma y color de sellos', 'stamps'],
    ['Editar bloque de premio', 'reward'],
  ] as const)('selects the %s zone when its direct preview control is clicked', (label, zone) => {
    const { container, onZoneSelect } = renderEditablePreview()
    const button = container.querySelector(`button[aria-label="${label}"]`)

    expect(button).not.toBeNull()
    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(onZoneSelect).toHaveBeenCalledWith(zone)
  })

  it('selects the stamps zone when a visible stamp itself is clicked', () => {
    const { container, onZoneSelect } = renderEditablePreview()
    const stamp = container.querySelector('[data-pass-stamp="0"]')

    expect(stamp).not.toBeNull()
    act(() => stamp?.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(onZoneSelect).toHaveBeenCalledWith('stamps')
  })

  it('announces the selected zone while keeping the QR and operational data protected', () => {
    const { container } = renderEditablePreview('reward')
    const rewardButton = container.querySelector('button[aria-label="Editar bloque de premio"]')

    expect(rewardButton?.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('[aria-label="Código QR protegido; no se puede editar"]')).not.toBeNull()
    expect(container.querySelector('button[aria-label*="QR"]')).toBeNull()
    expect(container.textContent).toContain('QR y datos reales')
  })

  it('renders a custom image on unfilled stamps when stampEmptyImageUrl is set', () => {
    const { container } = renderEditablePreview(undefined, {
      stampEmptyImageUrl: 'https://cdn.example.test/stamp-empty.png',
    })

    // sampleVisits defaults to 3, so stamp 3 is the first unfilled slot.
    const filledStamp = container.querySelector('[data-pass-stamp="0"] img')
    const emptyStamp = container.querySelector('[data-pass-stamp="3"] img')

    expect(filledStamp?.getAttribute('src')).toBe('https://cdn.example.test/stamp.png')
    expect(emptyStamp?.getAttribute('src')).toBe('https://cdn.example.test/stamp-empty.png')
  })

  it('falls back to the dashed border when no stampEmptyImageUrl is set', () => {
    const { container } = renderEditablePreview()

    const emptyStamp = container.querySelector('[data-pass-stamp="3"]')

    expect(emptyStamp?.querySelector('img')).toBeNull()
  })
})

describe('WalletPassPreview automatic letter color', () => {
  function renderWithBrandColor(brandColor: string, design: Record<string, unknown> = {}) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    mountedRoots.push(root)

    act(() => {
      root.render(
        <WalletPassPreview
          program={{
            type: 'visits',
            brandColor,
            programName: 'Titto Bros',
            // `as never`: el caso del color heredado escribe una propiedad que
            // el tipo ya no tiene, y es justo lo que se quiere comprobar.
            businessInfo: { design: { ...DEFAULT_PASS_DESIGN, cardStyle: 'solid', ...design } as never },
          }}
          config={{ visitsTarget: 10, rewardDescription: 'Helado gratis', visualStyle: 'stamp' }}
        />,
      )
    })

    const programName = [...container.querySelectorAll('span')].find(el => el.textContent === 'Titto Bros')
    return (programName as HTMLElement | undefined)?.style.color
  }

  it.each([
    // El rojo saturado de la marca: el cociente de WCAG 2 elegía negro aquí.
    ['#FA0405', 'rgb(255, 255, 255)'],
    ['#2563EB', 'rgb(255, 255, 255)'],
    ['#16A34A', 'rgb(255, 255, 255)'],
    ['#FFD400', 'rgb(0, 0, 0)'],
    ['#2DD4BF', 'rgb(0, 0, 0)'],
    ['#FFFFFF', 'rgb(0, 0, 0)'],
  ])('paints the letters over %s with the most readable of black and white', (brandColor, expected) => {
    expect(renderWithBrandColor(brandColor)).toBe(expected)
  })

  it('ignores a text color left over from the removed manual control', () => {
    // El editor ya no lo escribe; normalizePassDesign lo descarta, así que un
    // programa guardado con letras fijas vuelve al color legible.
    expect(renderWithBrandColor('#FA0405', { textColor: '#000000' })).toBe('rgb(255, 255, 255)')
  })
})
