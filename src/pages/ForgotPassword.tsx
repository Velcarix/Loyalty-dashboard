import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/api/v1/auth/forgot-password', { email: email.trim().toLowerCase() })
    } catch {
      // respuesta siempre genérica — no revela si el email existe
    } finally {
      setLoading(false)
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-bold text-gray-900">Recuperar contraseña</h1>
        {sent ? (
          <p className="mt-4 text-center text-sm text-gray-500">
            Si el email existe, te enviamos un enlace para restablecer tu contraseña.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-center text-sm text-gray-500">Te mandamos un enlace a tu email para restablecerla</p>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="tu@negocio.com" />
            <button type="submit" disabled={loading || !email}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50">
              {loading ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-gray-400">
          <Link to="/login">Volver a iniciar sesión</Link>
        </p>
      </div>
    </div>
  )
}
