import { create } from 'zustand'
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from '@/lib/api'
import type { MerchantProfile, MerchantLocation } from '@/types/loyalty'

interface AuthState {
  token: string | null
  merchant: MerchantProfile | null
  locations: MerchantLocation[]
  posLink: { linked: boolean; since?: string } | null
  isHydrated: boolean
  isAuthenticated: boolean

  hydrate: () => Promise<void>
  signup: (input: { email: string; password: string; businessName: string; vertical?: string; phone?: string }) => Promise<{ ok: boolean; message?: string }>
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  logout: () => void
  refreshProfile: () => Promise<boolean | null>
  primaryLocationId: () => string | null
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  merchant: null,
  locations: [],
  posLink: null,
  isHydrated: false,
  isAuthenticated: false,

  async hydrate() {
    const token = getToken()
    if (!token) {
      set({ token: null, merchant: null, locations: [], posLink: null, isAuthenticated: false, isHydrated: true })
      return
    }
    set({ token, isAuthenticated: false, isHydrated: false })
    const isValid = await get().refreshProfile()
    if (getToken() !== token) {
      set({ isHydrated: true })
      return
    }
    // A transient outage must not force a valid stored session back to login.
    set({ isAuthenticated: isValid !== false, isHydrated: true })
  },

  async signup({ email, password, businessName, vertical, phone }) {
    try {
      const data = await api.post<{ token: string; merchant: MerchantProfile }>('/api/v1/auth/signup', {
        email, password, businessName, vertical, phone,
      })
      setToken(data.token)
      set({ token: data.token, merchant: data.merchant, isAuthenticated: true })
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message ?? 'No se pudo crear la cuenta' }
    }
  },

  async login(email, password) {
    try {
      const data = await api.post<{ token: string; merchant: MerchantProfile }>('/api/v1/auth/login', { email, password })
      setToken(data.token)
      set({ token: data.token, merchant: data.merchant, isAuthenticated: true })
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message ?? 'Credenciales incorrectas' }
    }
  },

  logout() {
    clearToken()
    set({ token: null, merchant: null, locations: [], posLink: null, isAuthenticated: false })
  },

  async refreshProfile() {
    const requestToken = getToken()
    if (!requestToken) return false
    try {
      const data = await api.get<MerchantProfile & { locations: MerchantLocation[]; posLink: { linked: boolean; since?: string } }>('/api/v1/merchant')
      if (getToken() !== requestToken) return false
      const { locations, posLink, ...merchant } = data
      set({ merchant, locations: locations ?? [], posLink: posLink ?? null, isAuthenticated: true })
      return true
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 401 && getToken() === requestToken) {
        clearToken()
        set({ token: null, merchant: null, locations: [], posLink: null, isAuthenticated: false })
      }
      return status === 401 ? false : null
    }
  },

  primaryLocationId() {
    return get().locations[0]?.id ?? null
  },
}))

setUnauthorizedHandler(() => useAuthStore.getState().logout())
