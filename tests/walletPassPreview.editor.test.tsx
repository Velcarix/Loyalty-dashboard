import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletPassPreview } from '@/components/WalletPassPreview'

const mountedRoots: Root[] = []

function renderEditablePreview(selectedZone?: 'background' | 'identity' | 'progress' | 'stamps' | 'reward') {
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
            },
          },
        }}
        config={{
          visitsTarget: 7,
          rewardDescription: 'Helado gratis',
          visualStyle: 'stamp',
          stampImageUrl: 'https://cdn.example.test/stamp.png',
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
})
