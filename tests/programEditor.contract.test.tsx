import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgramEditor } from '@/pages/ProgramEditor'
import { useAuthStore } from '@/store/authStore'
import { useProgramsStore } from '@/store/programsStore'
import type { LoyaltyProgram, LoyaltyVisitsConfig } from '@/types/loyalty'

const originalCreateProgram = useProgramsStore.getState().createProgram
const originalUpdateProgram = useProgramsStore.getState().updateProgram
const mountedRoots: Root[] = []

function programFixture(type: 'visits'): LoyaltyProgram {
  return {
    id: `program-${type}`,
    businessId: 'merchant-1',
    name: `${type}-program`,
    type,
    isActive: true,
    brandColor: '#2563EB',
    logoUrl: 'https://cdn.example.test/logo.png',
    bannerUrl: null,
    programName: 'Café Rewards',
    description: 'Beneficios para clientes frecuentes',
    welcomeMessage: null,
    saldoLabel: null,
    businessInfo: null,
    askBirthday: false,
    askGender: false,
    customFields: null,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
  }
}

function renderEditor(path: string) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/programas/nuevo" element={<ProgramEditor />} />
          <Route path="/programas/:programId" element={<ProgramEditor />} />
        </Routes>
      </MemoryRouter>,
    )
  })

  const form = container.querySelector('form')
  if (!form) throw new Error('Program editor form was not rendered')
  return form
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  useAuthStore.setState({ posLink: { linked: true } })
  useProgramsStore.setState({ programs: [] })
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.replaceChildren()
  useAuthStore.setState({ posLink: null })
  useProgramsStore.setState({
    programs: [],
    createProgram: originalCreateProgram,
    updateProgram: originalUpdateProgram,
  })
})

describe('ProgramEditor configuration handoff', () => {
  it('keeps the stamps visual template selectable in the visits-only creation flow', () => {
    const form = renderEditor('/programas/nuevo')
    const stampsTemplate = Array.from(form.querySelectorAll('button')).find(button => button.textContent?.includes('Visitas visuales con sello personalizado'))

    expect(stampsTemplate).toBeInstanceOf(HTMLButtonElement)
    act(() => stampsTemplate?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(stampsTemplate?.getAttribute('aria-pressed')).toBe('true')
  })

  it('sends the complete visits contract when an existing visits program is saved', async () => {
    const program = programFixture('visits')
    const config: LoyaltyVisitsConfig = {
      programId: program.id,
      visitsTarget: 8,
      rewardDescription: 'Café gratis',
      maxVisitsPerDay: 2,
      visualStyle: 'stamp',
      stampImageUrl: 'https://cdn.example.test/stamp.png',
    }
    const updateProgram = vi.fn().mockResolvedValue(undefined)
    useProgramsStore.setState({
      programs: [{ program, config }],
      updateProgram,
    })

    const form = renderEditor(`/programas/${program.id}`)
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(updateProgram).toHaveBeenCalledWith(
      program.id,
      expect.any(Object),
      {
        visitsTarget: 8,
        rewardDescription: 'Café gratis',
        maxVisitsPerDay: 2,
        visualStyle: 'stamp',
        applyToExistingCustomers: false,
      },
    )
  })
})
