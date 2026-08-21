import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import { Settings } from '@/pages/Settings'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const mountedRoots: Root[] = []
const originalRefreshProfile = useAuthStore.getState().refreshProfile

function renderSettings() {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => { root.render(<Settings />) })
  return container
}

async function settle() {
  await act(async () => { await Promise.resolve() })
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  useAuthStore.setState({
    merchant: { id: 'merchant-1', email: 'ana@example.test', businessName: 'Café Copo', vertical: null, plan: 'trial', phone: null, mostradorSessionSeconds: 90 },
    locations: [],
    posLink: null,
    refreshProfile: vi.fn().mockResolvedValue(true),
  })
  vi.spyOn(QRCode, 'toCanvas').mockResolvedValue(undefined)
})

afterEach(async () => {
  await act(async () => { for (const root of mountedRoots.splice(0)) root.unmount() })
  document.body.replaceChildren()
  vi.restoreAllMocks()
  useAuthStore.setState({ refreshProfile: originalRefreshProfile })
})

describe('Settings mostrador devices', () => {
  it('loads devices and makes stale authorization visible', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([
      { id: 'device-1', label: 'iPhone de Ana', createdAt: '2026-08-12T10:00:00.000Z', lastUsedAt: null },
      { id: 'device-2', label: 'iPad mostrador', createdAt: '2026-07-04T10:00:00.000Z', lastUsedAt: '2026-08-20T10:00:00.000Z' },
    ])

    const container = renderSettings()
    await settle()

    expect(api.get).toHaveBeenCalledWith('/api/v1/integrations/pos/mostrador/devices')
    expect(container.textContent).toContain('iPhone de Ana')
    expect(container.textContent).toContain('Nunca')
    expect(container.textContent).toContain('iPad mostrador')
  })

  it('generates a disposable eight-digit code in the connection modal', async () => {
    vi.spyOn(api, 'get').mockResolvedValue([])
    vi.spyOn(api, 'post').mockResolvedValue({ code: '04831927', expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() })
    const container = renderSettings()
    await settle()

    const openButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Conectar un teléfono')
    if (!openButton) throw new Error('Missing connect button')
    await act(async () => { openButton.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const generateButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Generar código')
    if (!generateButton) throw new Error('Missing generate button')
    await act(async () => { generateButton.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await settle()

    expect(api.post).toHaveBeenCalledWith('/api/v1/integrations/pos/mostrador/code', { label: 'Teléfono' })
    expect(container.textContent).toContain('0483 1927')
    expect(container.textContent).toContain('mostrador.copopos.com')
    expect(container.textContent).toContain('No lo compartas.')
  })

  it('revokes one selected device and refreshes the list', async () => {
    const get = vi.spyOn(api, 'get').mockResolvedValue([{ id: 'device-1', label: 'iPhone de Ana', createdAt: '2026-08-12T10:00:00.000Z', lastUsedAt: null }])
    const remove = vi.spyOn(api, 'delete').mockResolvedValue({})
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true)
    const container = renderSettings()
    await settle()

    const revokeButton = Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Revocar')
    if (!revokeButton) throw new Error('Missing revoke button')
    await act(async () => { revokeButton.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await settle()

    expect(remove).toHaveBeenCalledWith('/api/v1/integrations/pos/mostrador/devices/device-1')
    expect(get).toHaveBeenCalledTimes(2)
  })
})
