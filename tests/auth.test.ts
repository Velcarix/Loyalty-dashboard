import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, getToken, setToken } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

const merchant = {
  id: 'merchant-1',
  email: 'owner@example.com',
  businessName: 'Copo',
  vertical: null,
  phone: null,
  plan: 'pro',
  mostradorSessionSeconds: 900,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('authentication lifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      token: null,
      merchant: null,
      locations: [],
      posLink: null,
      isHydrated: false,
      isAuthenticated: false,
    })
    vi.restoreAllMocks()
  })

  it('hydrates as signed out when there is no token', async () => {
    await useAuthStore.getState().hydrate()

    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      isAuthenticated: false,
      isHydrated: true,
    })
  })

  it('validates a stored token before authenticating', async () => {
    setToken('valid-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      data: { ...merchant, locations: [{ id: 'location-1', name: 'Centro', isActive: true }], posLink: { linked: true } },
    })))

    await useAuthStore.getState().hydrate()

    expect(useAuthStore.getState()).toMatchObject({
      token: 'valid-token',
      merchant,
      isAuthenticated: true,
      isHydrated: true,
    })
    expect(useAuthStore.getState().primaryLocationId()).toBe('location-1')
  })

  it('fully clears an expired session during hydration', async () => {
    setToken('expired-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: { code: 'TOKEN_EXPIRED', message: 'Expired' },
    }, 401)))

    await useAuthStore.getState().hydrate()

    expect(getToken()).toBeNull()
    expect(useAuthStore.getState()).toMatchObject({
      token: null,
      merchant: null,
      locations: [],
      isAuthenticated: false,
      isHydrated: true,
    })
  })

  it('preserves a stored token after a transient profile failure', async () => {
    setToken('valid-token')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: { message: 'Unavailable' } }, 503)))

    await useAuthStore.getState().hydrate()

    expect(getToken()).toBe('valid-token')
    expect(useAuthStore.getState()).toMatchObject({ token: 'valid-token', isAuthenticated: true, isHydrated: true })
  })

  it('does not restore a session when logout wins a pending profile request', async () => {
    setToken('old-token')
    let resolveRequest!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveRequest = resolve })))

    const hydration = useAuthStore.getState().hydrate()
    useAuthStore.getState().logout()
    resolveRequest(jsonResponse({ data: { ...merchant, locations: [], posLink: null } }))
    await hydration

    expect(useAuthStore.getState()).toMatchObject({ token: null, merchant: null, isAuthenticated: false })
  })

  it('does not overwrite a newer login when old hydration completes', async () => {
    setToken('old-token')
    let resolveRequest!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveRequest = resolve })))

    const hydration = useAuthStore.getState().hydrate()
    setToken('new-token')
    useAuthStore.setState({ token: 'new-token', merchant, isAuthenticated: true })
    resolveRequest(jsonResponse({ data: { ...merchant, locations: [], posLink: null } }))
    await hydration

    expect(useAuthStore.getState()).toMatchObject({ token: 'new-token', merchant, isAuthenticated: true, isHydrated: true })
  })

  it('clears both storage and store when an upload receives 401', async () => {
    setToken('expired-token')
    useAuthStore.setState({ token: 'expired-token', merchant, isAuthenticated: true })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({
      error: { code: 'TOKEN_EXPIRED', message: 'Expired' },
    }, 401)))

    await expect(api.uploadFile('/api/v1/upload', new FormData())).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
      status: 401,
    })
    expect(getToken()).toBeNull()
    expect(useAuthStore.getState()).toMatchObject({ token: null, merchant: null, isAuthenticated: false })
  })

  it('ignores a late 401 from a previous session', async () => {
    setToken('old-token')
    useAuthStore.setState({ token: 'old-token', isAuthenticated: true })
    let resolveRequest!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveRequest = resolve })))

    const oldRequest = api.get('/api/v1/merchant')
    setToken('new-token')
    useAuthStore.setState({ token: 'new-token', isAuthenticated: true })
    resolveRequest(jsonResponse({ error: { code: 'TOKEN_EXPIRED', message: 'Expired' } }, 401))
    await expect(oldRequest).rejects.toMatchObject({ status: 401 })

    expect(getToken()).toBe('new-token')
    expect(useAuthStore.getState()).toMatchObject({ token: 'new-token', isAuthenticated: true })
  })
})
