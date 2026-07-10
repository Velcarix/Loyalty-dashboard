import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = useAuthStore(s => s.login)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await login(email.trim().toLowerCase(), password)
    setLoading(false)
    if (result.ok) navigate('/programas')
    else setError(result.message ?? 'Credenciales incorrectas')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Copo Loyalty</h1>
          <p className="mt-1 text-sm text-gray-500">Inicia sesión en tu cuenta</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="tu@negocio.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>
          <div className="flex justify-between text-xs">
            <Link to="/forgot-password" className="text-primary">¿Olvidaste tu contraseña?</Link>
            <Link to="/signup" className="text-gray-500">Crear cuenta</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
