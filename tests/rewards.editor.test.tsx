import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Rewards } from '@/pages/Rewards'
import { useAuthStore } from '@/store/authStore'
import { useProgramsStore } from '@/store/programsStore'
import type { LoyaltyProgram, LoyaltyReward, PosCatalogProduct } from '@/types/loyalty'

const originalProgramsState = useProgramsStore.getState()
const originalAuthState = useAuthStore.getState()
const mountedRoots: Root[] = []

function programFixture(type: 'points' | 'visits', overrides: Partial<LoyaltyProgram> = {}): LoyaltyProgram {
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
    ...overrides,
  }
}

function rewardFixture(overrides: Partial<LoyaltyReward> = {}): LoyaltyReward {
  return {
    id: 'reward-1',
    programId: 'program-visits',
    type: 'pct_discount',
    name: 'Descuento clásico',
    description: '15% en tu próxima visita',
    imageUrl: null,
    pointsRequired: 5,
    isActive: true,
    usageCount: 0,
    usageLimit: null,
    perUserLimit: null,
    minTierId: null,
    startsAt: null,
    expiresAt: null,
    config: { discountPct: 15 },
    eligibility: null,
    ...overrides,
  }
}

function productFixture(overrides: Partial<PosCatalogProduct> = {}): PosCatalogProduct {
  return { id: 'prod-1', name: 'Café americano', category: 'bebidas', branchId: 'branch-1', branchName: 'Sucursal Centro', ...overrides }
}

function setValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

function setSelectValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.trim() === text)
  if (!button) throw new Error(`No button found with text "${text}"`)
  return button
}

function renderRewards(programId: string): HTMLElement {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/programas/${programId}/rewards`]}>
        <Routes>
          <Route path="/programas/:programId/rewards" element={<Rewards />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  return container
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

afterEach(async () => {
  await act(async () => {
    for (const root of mountedRoots.splice(0)) root.unmount()
  })
  document.body.replaceChildren()
  useProgramsStore.setState(originalProgramsState, true)
  useAuthStore.setState(originalAuthState, true)
})

describe('Rewards list', () => {
  it('shows a plain-language summary of the config next to each reward', () => {
    const program = programFixture('visits')
    const reward = rewardFixture({ type: 'free_product', config: { productName: 'Café' } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [reward],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
    })

    const container = renderRewards(program.id)
    expect(container.textContent).toContain('Gratis: Café')
  })
})

describe('Rewards editor', () => {
  it('blocks saving a reward whose config draft fails validation', async () => {
    const program = programFixture('visits')
    const createReward = vi.fn().mockResolvedValue(undefined)
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      createReward,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    // El tipo por defecto es "free_product" con productName vacío — inválido.
    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/producto/i)
  })

  it('sends the updated discount percentage on save', async () => {
    const program = programFixture('visits')
    const existing = rewardFixture({ config: { discountPct: 15 } })
    const updateReward = vi.fn().mockResolvedValue(undefined)
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [existing],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      updateReward,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, 'Editar').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const pctInput = container.querySelector('input[placeholder="% de descuento"]') as HTMLInputElement
    setValue(pctInput, '25')

    await act(async () => findButton(container, 'Guardar').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(updateReward).toHaveBeenCalledWith(
      program.id,
      existing.id,
      expect.objectContaining({ type: 'pct_discount', config: { discountPct: 25 } }),
    )
  })

  it('translates "lleva N, paga M" into the backend\'s buyQty/getQty contract on save', async () => {
    const program = programFixture('visits')
    const createReward = vi.fn().mockResolvedValue(undefined)
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      createReward,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    const bxgyType = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Lleva N, paga M'))
    if (!bxgyType) throw new Error('No se encontró el tipo "Lleva N, paga M"')
    act(() => bxgyType.dispatchEvent(new MouseEvent('click', { bubbles: true })))

    setValue(container.querySelector('input[placeholder="Producto/servicio a entregar"]') as HTMLInputElement, 'Bebida')
    setValue(container.querySelector('input[placeholder="Lleva (ej. 2)"]') as HTMLInputElement, '2')
    setValue(container.querySelector('input[placeholder="Paga (ej. 1)"]') as HTMLInputElement, '1')

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).toHaveBeenCalledWith(
      program.id,
      expect.objectContaining({ type: 'bxgy', config: { productName: 'Bebida', buyQty: 1, getQty: 1 } }),
    )
  })
})

describe('POS catalog picker', () => {
  it('keeps the free-text input when there is no POS linked', () => {
    const program = programFixture('visits')
    useAuthStore.setState({ posLink: null })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('input[placeholder="Producto/servicio a entregar"]')).not.toBeNull()
    expect(container.querySelector('select')).toBeNull()
  })

  it('shows a select with the POS catalog when linked, and defaults to it over free text', () => {
    const program = programFixture('visits')
    useAuthStore.setState({ posLink: { linked: true } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
      posCatalog: [productFixture({ id: 'prod-1', name: 'Café americano' }), productFixture({ id: 'prod-2', name: 'Té helado' })],
      posCatalogError: null,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const select = container.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(Array.from(select.options).map(o => o.textContent)).toEqual(['Selecciona un producto del catálogo', 'Café americano', 'Té helado'])
    expect(container.querySelector('input[placeholder="Producto/servicio a entregar"]')).toBeNull()
  })

  it('sends posProductId + productName when a catalog product is picked', async () => {
    const program = programFixture('visits')
    const createReward = vi.fn().mockResolvedValue(undefined)
    useAuthStore.setState({ posLink: { linked: true } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
      posCatalog: [productFixture({ id: 'prod-1', name: 'Café americano' })],
      posCatalogError: null,
      createReward,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    setSelectValue(container.querySelector('select') as HTMLSelectElement, 'prod-1')

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).toHaveBeenCalledWith(
      program.id,
      expect.objectContaining({ type: 'free_product', config: { productName: 'Café americano', posProductId: 'prod-1' } }),
    )
  })

  it('lets the owner switch to free text ("Escribir a mano") and back, clearing posProductId', () => {
    const program = programFixture('visits')
    useAuthStore.setState({ posLink: { linked: true } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
      posCatalog: [productFixture()],
      posCatalogError: null,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    act(() => findButton(container, 'Escribir a mano').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('input[placeholder="Producto/servicio a entregar"]')).not.toBeNull()

    act(() => findButton(container, 'Elegir del catálogo').dispatchEvent(new MouseEvent('click', { bubbles: true })))
    expect(container.querySelector('select')).not.toBeNull()
  })

  it('preselects the linked catalog product when editing an existing reward', () => {
    const program = programFixture('visits')
    const reward = rewardFixture({ type: 'free_product', config: { productName: 'Café americano', posProductId: 'prod-1' } })
    useAuthStore.setState({ posLink: { linked: true } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [reward],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
      posCatalog: [productFixture({ id: 'prod-1', name: 'Café americano' })],
      posCatalogError: null,
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, 'Editar').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    const select = container.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('prod-1')
  })

  it('falls back to free text with a warning when the POS catalog failed to load', () => {
    const program = programFixture('visits')
    useAuthStore.setState({ posLink: { linked: true } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
      posCatalog: [],
      posCatalogError: 'unavailable',
    })

    const container = renderRewards(program.id)
    act(() => findButton(container, '+ Nueva recompensa').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(container.querySelector('select')).toBeNull()
    expect(container.querySelector('input[placeholder="Producto/servicio a entregar"]')).not.toBeNull()
    expect(container.textContent).toContain('No se pudo cargar el catálogo del POS')
  })
})

describe('Reward scope editor', () => {
  function click(el: Element) {
    act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  }

  function typeButton(container: HTMLElement, label: string): HTMLButtonElement {
    const button = Array.from(container.querySelectorAll('button')).find(b => b.querySelector('p')?.textContent === label)
    if (!button) throw new Error(`No reward type button "${label}"`)
    return button
  }

  function setupLinkedCatalog(createReward = vi.fn().mockResolvedValue(undefined)) {
    const program = programFixture('visits')
    useAuthStore.setState({ posLink: { linked: true } })
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      loadPosCatalog: vi.fn().mockResolvedValue(undefined),
      posCatalog: [
        productFixture({ id: 'prod-1', name: 'Café americano', category: 'Bebidas', branchId: 'b1', branchName: 'Centro' }),
        productFixture({ id: 'prod-9', name: 'Café americano', category: 'Bebidas', branchId: 'b2', branchName: 'Norte' }),
        productFixture({ id: 'prod-2', name: 'Pastel', category: 'Postres', branchId: 'b1', branchName: 'Centro' }),
      ],
      posCatalogError: null,
      createReward,
    })
    const container = renderRewards(program.id)
    click(findButton(container, '+ Nueva recompensa'))
    return { container, program, createReward }
  }

  function fillBasics(container: HTMLElement) {
    setValue(container.querySelector('input[placeholder="Nombre"]') as HTMLInputElement, 'Promo')
    setValue(container.querySelector('input[placeholder="Descripción"]') as HTMLInputElement, 'Promo')
  }

  it('no longer offers "Exclusivo VIP" when creating a reward', () => {
    const { container } = setupLinkedCatalog()
    const labels = Array.from(container.querySelectorAll('button p.font-semibold')).map(p => p.textContent)
    expect(labels).toEqual(['Producto/servicio gratis', 'Descuento %', 'Descuento fijo', 'Lleva N, paga M'])
  })

  it('still labels an existing VIP reward in the list', () => {
    const program = programFixture('visits')
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [rewardFixture({ type: 'vip_exclusive', config: {} })],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
    })
    expect(renderRewards(program.id).textContent).toContain('Exclusivo VIP')
  })

  it('does not show a scope picker for a free product', () => {
    const { container } = setupLinkedCatalog()
    expect(container.querySelector('[data-testid="reward-scope"]')).toBeNull()
  })

  it('sends a % discount scoped to a catalog category', async () => {
    const { container, program, createReward } = setupLinkedCatalog()
    click(typeButton(container, 'Descuento %'))
    fillBasics(container)
    setValue(container.querySelector('input[placeholder="% de descuento"]') as HTMLInputElement, '20')
    click(findButton(container, 'Categorías'))
    expect(Array.from(container.querySelectorAll('button[aria-pressed]')).map(b => b.textContent)).toEqual(['Bebidas', 'Postres'])
    click(findButton(container, 'Bebidas'))

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).toHaveBeenCalledWith(program.id, expect.objectContaining({
      type: 'pct_discount',
      config: { discountPct: 20, scope: { appliesTo: 'categories', categories: ['Bebidas'] } },
    }))
  })

  it('sends a fixed discount scoped to a product with the ids of every branch', async () => {
    const { container, program, createReward } = setupLinkedCatalog()
    click(typeButton(container, 'Descuento fijo'))
    fillBasics(container)
    setValue(container.querySelector('input[placeholder="Monto ($)"]') as HTMLInputElement, '30')
    click(findButton(container, 'Productos específicos'))
    setSelectValue(container.querySelector('select[aria-label="Agregar producto del catálogo"]') as HTMLSelectElement, 'Café americano')

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).toHaveBeenCalledWith(program.id, expect.objectContaining({
      type: 'fixed_discount',
      config: { discountCents: 3000, scope: { appliesTo: 'products', products: [{ name: 'Café americano', posProductIds: ['prod-1', 'prod-9'] }] } },
    }))
  })

  it('blocks saving a category-scoped discount with no category selected', async () => {
    const { container, createReward } = setupLinkedCatalog()
    click(typeButton(container, 'Descuento %'))
    fillBasics(container)
    setValue(container.querySelector('input[placeholder="% de descuento"]') as HTMLInputElement, '20')
    click(findButton(container, 'Categorías'))

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toMatch(/categoría/i)
  })

  it('lets a "Lleva N, paga M" apply to a whole category instead of one product', async () => {
    const { container, program, createReward } = setupLinkedCatalog()
    click(typeButton(container, 'Lleva N, paga M'))
    fillBasics(container)
    click(findButton(container, 'Categorías'))
    // El selector de producto único desaparece en modo categoría.
    expect(Array.from(container.querySelectorAll('option')).some(o => o.textContent === 'Selecciona un producto del catálogo')).toBe(false)
    click(findButton(container, 'Bebidas'))

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).toHaveBeenCalledWith(program.id, expect.objectContaining({
      type: 'bxgy',
      config: { buyQty: 1, getQty: 1, scope: { appliesTo: 'categories', categories: ['Bebidas'] } },
    }))
  })

  it('allows typing a category by hand when there is no POS catalog', async () => {
    const program = programFixture('visits')
    const createReward = vi.fn().mockResolvedValue(undefined)
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
      createReward,
    })
    const container = renderRewards(program.id)
    click(findButton(container, '+ Nueva recompensa'))
    click(typeButton(container, 'Descuento %'))
    fillBasics(container)
    setValue(container.querySelector('input[placeholder="% de descuento"]') as HTMLInputElement, '10')
    click(findButton(container, 'Categorías'))
    setValue(container.querySelector('input[placeholder^="Nombre de la categoría"]') as HTMLInputElement, 'Bebidas')
    click(findButton(container, 'Agregar categoría'))

    await act(async () => findButton(container, 'Crear').dispatchEvent(new MouseEvent('click', { bubbles: true })))

    expect(createReward).toHaveBeenCalledWith(program.id, expect.objectContaining({
      config: { discountPct: 10, scope: { appliesTo: 'categories', categories: ['Bebidas'] } },
    }))
  })

  it('reopens a scoped reward with its categories preselected', () => {
    const program = programFixture('visits')
    useProgramsStore.setState({
      programs: [{ program, config: null }],
      rewards: [rewardFixture({ config: { discountPct: 15, scope: { appliesTo: 'categories', categories: ['Postres'] } } })],
      isLoadingRewards: false,
      loadRewards: vi.fn().mockResolvedValue(undefined),
    })
    const container = renderRewards(program.id)
    expect(container.textContent).toContain('15% de descuento en Postres')
    click(findButton(container, 'Editar'))
    expect(container.querySelector('button[role="radio"][aria-checked="true"]')?.textContent).toBe('Categorías')
    expect(container.querySelector('button[aria-pressed="true"]')?.textContent).toBe('Postres')
  })
})
