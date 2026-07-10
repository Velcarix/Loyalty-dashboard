import { create } from 'zustand'
import { api, getToken, setToken, clearToken } from '@/lib/api'
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
  refreshProfile: () => Promise<void>
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
      set({ isHydrated: true })
      return
    }
    set({ token, isAuthenticated: true, isHydrated: true })
    await get().refreshProfile()
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
    try {
      const data = await api.get<MerchantProfile & { locations: MerchantLocation[]; posLink: { linked: boolean; since?: string } }>('/api/v1/merchant')
      const { locations, posLink, ...merchant } = data
      set({ merchant, locations: locations ?? [], posLink: posLink ?? null })
    } catch {
      // token inválido/expirado — el cliente ya limpió el token en clearToken()
    }
  },

  primaryLocationId() {
    return get().locations[0]?.id ?? null
  },
}))
