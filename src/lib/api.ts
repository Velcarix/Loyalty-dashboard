/**
 * Cliente API del dashboard — contra loyalty-api (servicio standalone), mismos
 * endpoints merchantAuth que usa la app mobile-loyalty (login/signup, /programs,
 * /merchant, /integrations/pos/*). Token en localStorage (dashboard = solo web).
 */

const BASE_URL = import.meta.env.VITE_LOYALTY_API_URL as string | undefined
const TOKEN_KEY = 'copo_loyalty_dashboard_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

type ApiResponse<T> = { data: T }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new Error('VITE_LOYALTY_API_URL no está configurado')
  }
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: res.statusText } }))
    const err = body?.error ?? { code: 'HTTP_ERROR', message: res.statusText }

    if (res.status === 401) {
      clearToken()
    }

    throw Object.assign(new Error(err.message), { code: err.code, status: res.status })
  }

  const body: ApiResponse<T> = await res.json()
  return body.data
}

/**
 * Multipart upload (logo/banner) — sin Content-Type: application/json, el
 * navegador pone el boundary correcto solo si no lo pisamos nosotros.
 */
async function uploadFile<T>(path: string, form: FormData): Promise<T> {
  if (!BASE_URL) {
    throw new Error('VITE_LOYALTY_API_URL no está configurado')
  }
  const token = getToken()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers, body: form })
  const body = await res.json().catch(() => ({ error: { code: 'UNKNOWN', message: res.statusText } }))
  if (!res.ok) {
    const err = body?.error ?? { code: 'HTTP_ERROR', message: res.statusText }
    throw Object.assign(new Error(err.message), { code: err.code, status: res.status })
  }
  return (body as ApiResponse<T>).data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  uploadFile,
}
