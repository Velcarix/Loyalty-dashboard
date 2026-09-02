import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const VERTICALS = [
  'Heladería', 'Cafetería', 'Pastelería', 'Barbería', 'Estética', 'Gimnasio', 'Lavandería', 'Boutique', 'Otro',
]

export function Signup() {
  const [businessName, setBusinessName] = useState('')
  const [vertical, setVertical] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const signup = useAuthStore(s => s.signup)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setLoading(true)
    setError('')
    const result = await signup({ email: email.trim().toLowerCase(), password, businessName: businessName.trim(), vertical: vertical || undefined })
    setLoading(false)
    if (result.ok) navigate('/programas')
    else setError(result.message ?? 'No se pudo crear la cuenta')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex items-center justify-center gap-1.5">
            <img src="/brand/copo-mark.png" alt="Copo" className="h-10 w-10 object-contain" />
            <span className="text-xl font-extrabold tracking-tight text-ink">Copo</span>
          </div>
          <h1 className="text-2xl font-bold text-ink">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-gray-500">Empieza a fidelizar clientes en minutos</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Nombre del negocio</label>
            <input required value={businessName} onChange={e => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Heladería La Michoacana" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Giro del negocio</label>
            <select value={vertical} onChange={e => setVertical(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
              <option value="">Selecciona…</option>
              {VERTICALS.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="tu@negocio.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Contraseña</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="Mínimo 8 caracteres" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-primary-dark active:scale-[0.98] disabled:opacity-50">
            {loading ? 'Creando…' : 'Crear cuenta'}
          </button>
          <p className="text-center text-xs text-gray-500">
            ¿Ya tienes cuenta? <Link to="/login" className="text-primary">Inicia sesión</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
