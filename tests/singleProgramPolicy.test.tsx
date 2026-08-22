import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgramEditor } from '@/pages/ProgramEditor'
import { ProgramsList } from '@/pages/ProgramsList'
import { useProgramsStore } from '@/store/programsStore'
import type { LoyaltyProgram, LoyaltyVisitsConfig } from '@/types/loyalty'

const mountedRoots: Root[] = []
const originalCreateProgram = useProgramsStore.getState().createProgram
const originalLoadPrograms = useProgramsStore.getState().loadPrograms

const program: LoyaltyProgram = {
  id: 'only-program',
  businessId: 'merchant-1',
  name: 'only-program',
  type: 'visits',
  isActive: true,
  brandColor: '#2563EB',
  logoUrl: '',
  bannerUrl: null,
  programName: 'Café Rewards',
  description: 'Beneficios para clientes frecuentes',
  welcomeMessage: null,
  saldoLabel: null,
  businessInfo: null,
  askBirthday: false,
  askGender: false,
  customFields: null,
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
}

const config: LoyaltyVisitsConfig = {
  programId: program.id,
  visitsTarget: 8,
  rewardDescription: 'Café gratis',
  maxVisitsPerDay: 1,
  visualStyle: 'number',
  stampImageUrl: null,
}

function renderAt(path: string, page: 'list' | 'editor') {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/programas" element={page === 'list' ? <ProgramsList /> : null} />
          <Route path="/programas/nuevo" element={page === 'editor' ? <ProgramEditor /> : null} />
          <Route path="/programas/:programId/editar" element={<ProgramEditor />} />
          <Route path="/programas/:programId" element={<p>Programa existente</p>} />
        </Routes>
      </MemoryRouter>,
    )
  })

  return container
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  useProgramsStore.setState({
    programs: [],
    isLoading: false,
    loadPrograms: vi.fn().mockResolvedValue(undefined),
  })
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.replaceChildren()
  useProgramsStore.setState({
    programs: [],
    isLoading: false,
    createProgram: originalCreateProgram,
    loadPrograms: originalLoadPrograms,
  })
})

describe('single loyalty-program policy', () => {
  it('hides every creation action from the listing once a program already exists', () => {
    useProgramsStore.setState({ programs: [{ program, config }] })

    const container = renderAt('/programas', 'list')
    const newProgramLinks = Array.from(container.querySelectorAll('a[href="/programas/nuevo"]'))

    expect(container.textContent).toContain('Café Rewards')
    expect(newProgramLinks).toHaveLength(0)
    expect(container.textContent).not.toContain('Crear programa')
    expect(container.textContent).not.toContain('Nuevo programa')
  })

  it('creates new programs as visits only and exposes no points mechanic action', async () => {
    const createProgram = vi.fn().mockResolvedValue(program)
    useProgramsStore.setState({ createProgram })

    const container = renderAt('/programas/nuevo', 'editor')
    const form = container.querySelector('form')
    const buttons = Array.from(container.querySelectorAll('button'))

    expect(form).toBeInstanceOf(HTMLFormElement)
    expect(container.textContent).toContain('Cuentan visitas hasta un objetivo')
    expect(container.textContent).not.toContain('Ganan puntos por compra')
    expect(buttons.some(button => button.textContent?.trim() === 'Puntos')).toBe(false)

    await act(async () => {})
    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(createProgram).toHaveBeenCalledWith(expect.objectContaining({ type: 'visits' }))
  })

  it('never invokes program creation from the direct new route when a program is already in the store', async () => {
    const createProgram = vi.fn().mockResolvedValue(program)
    useProgramsStore.setState({ programs: [{ program, config }], createProgram })

    const container = renderAt('/programas/nuevo', 'editor')
    await act(async () => {})

    expect(container.textContent).toContain('Programa existente')
    expect(container.querySelector('form')).toBeNull()
    expect(createProgram).not.toHaveBeenCalled()
  })

  it('returns to the existing program when the API rejects a concurrent creation', async () => {
    const conflict = Object.assign(new Error('Este negocio ya tiene un programa de lealtad.'), {
      status: 409,
      code: 'PROGRAM_ALREADY_EXISTS',
    })
    const createProgram = vi.fn().mockRejectedValue(conflict)
    const loadPrograms = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        useProgramsStore.setState({ programs: [{ program, config }] })
      })
    useProgramsStore.setState({ createProgram, loadPrograms })

    const container = renderAt('/programas/nuevo', 'editor')
    await act(async () => {})
    const form = container.querySelector('form')

    await act(async () => {
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    expect(createProgram).toHaveBeenCalledWith(expect.objectContaining({ type: 'visits' }))
    expect(loadPrograms).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Programa existente')
  })
})
