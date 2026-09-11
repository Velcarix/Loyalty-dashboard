import { create } from 'zustand'
import { api, getToken, setToken, clearToken, setUnauthorizedHandler } from '@/lib/api'
import { useProgramsStore } from '@/store/programsStore'
import type { CurrentUser, MerchantProfile, MerchantLocation } from '@/types/loyalty'

interface AuthState {
  token: string | null
  merchant: MerchantProfile | null
  /** Dueño o admin del equipo en sesión — null hasta el primer refreshProfile. */
  currentUser: CurrentUser | null
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

const signedOut = { token: null, merchant: null, currentUser: null, locations: [], posLink: null, isAuthenticated: false }

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  merchant: null,
  currentUser: null,
  locations: [],
  posLink: null,
  isHydrated: false,
  isAuthenticated: false,

  async hydrate() {
    const token = getToken()
    if (!token) {
      useProgramsStore.getState().reset()
      set({ ...signedOut, isHydrated: true })
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
      useProgramsStore.getState().reset()
      set({ token: data.token, merchant: data.merchant, isAuthenticated: true })
      void get().refreshProfile()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message ?? 'No se pudo crear la cuenta' }
    }
  },

  async login(email, password) {
    try {
      const data = await api.post<{ token: string; merchant: MerchantProfile }>('/api/v1/auth/login', { email, password })
      setToken(data.token)
      useProgramsStore.getState().reset()
      set({ token: data.token, merchant: data.merchant, isAuthenticated: true })
      void get().refreshProfile()
      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message ?? 'Credenciales incorrectas' }
    }
  },

  logout() {
    clearToken()
    useProgramsStore.getState().reset()
    set(signedOut)
  },

  async refreshProfile() {
    const requestToken = getToken()
    if (!requestToken) return false
    try {
      const data = await api.get<MerchantProfile & {
        locations: MerchantLocation[]
        posLink: { linked: boolean; since?: string }
        currentUser?: CurrentUser
      }>('/api/v1/merchant')
      if (getToken() !== requestToken) return false
      const { locations, posLink, currentUser, ...merchant } = data
      set({ merchant, currentUser: currentUser ?? null, locations: locations ?? [], posLink: posLink ?? null, isAuthenticated: true })
      return true
    } catch (error) {
      const status = (error as { status?: number }).status
      if (status === 401 && getToken() === requestToken) {
        clearToken()
        useProgramsStore.getState().reset()
        set(signedOut)
      }
      return status === 401 ? false : null
    }
  },

  primaryLocationId() {
    return get().locations[0]?.id ?? null
  },
}))

setUnauthorizedHandler(() => useAuthStore.getState().logout())
