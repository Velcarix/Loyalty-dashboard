import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Icon } from '@/components/Icon'
import type { TeamUser } from '@/types/loyalty'

function formatLastLogin(value: string | null): string {
  if (!value) return 'Nunca ha entrado'
  return `Último acceso ${new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`
}

export function TeamSection() {
  const [users, setUsers] = useState<TeamUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [saving, setSaving] = useState(false)
  const [resetFor, setResetFor] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function load() {
    try {
      setUsers(await api.get<TeamUser[]>('/api/v1/merchant/team'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el equipo')
    }
  }

  useEffect(() => { void load() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await api.post('/api/v1/merchant/team', { name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password })
      setNotice(`Listo. Comparte con ${form.name.trim()} su correo y contraseña; entra desde la misma pantalla de inicio de sesión.`)
      setForm({ name: '', email: '', password: '' })
      setAdding(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword(user: TeamUser) {
    if (newPassword.length < 8) return
    setBusyId(user.id)
    setError(null)
    try {
      await api.put(`/api/v1/merchant/team/${user.id}/password`, { password: newPassword })
      setNotice(`Contraseña de ${user.name} cambiada. Sus sesiones abiertas se cerraron.`)
      setResetFor(null)
      setNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(user: TeamUser) {
    if (!confirm(`¿Quitar a ${user.name} del equipo? Perderá el acceso de inmediato.`)) return
    setBusyId(user.id)
    setError(null)
    try {
      await api.delete(`/api/v1/merchant/team/${user.id}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo quitar')
    } finally {
      setBusyId(null)
    }
  }

  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-gray-500">Administradores con su propio acceso. Pueden hacer todo en el dashboard excepto administrar al equipo. Sin límite de administradores.</p>
      {notice && <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800" role="status">{notice}</p>}
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">{error}</p>}

      {!users ? <p className="text-sm text-slate-400">Cargando…</p> : users.length === 0 ? (
        <p className="text-sm text-slate-400">Solo tú tienes acceso por ahora.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {users.map(user => (
            <li key={user.id} className="py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                  <p className="text-[11px] text-slate-400">{formatLastLogin(user.lastLoginAt)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => { setResetFor(resetFor === user.id ? null : user.id); setNewPassword('') }} className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Cambiar contraseña</button>
                  <button type="button" onClick={() => void handleRemove(user)} disabled={busyId === user.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" aria-label={`Quitar a ${user.name}`}><Icon name="trash" size={16} /></button>
                </div>
              </div>
              {resetFor === user.id && (
                <div className="mt-2 flex gap-2">
                  <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nueva contraseña (mín. 8)" aria-label={`Nueva contraseña para ${user.name}`}
                    className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none" />
                  <button type="button" onClick={() => void handleResetPassword(user)} disabled={newPassword.length < 8 || busyId === user.id} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Guardar</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <form onSubmit={handleAdd} className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-3">
          <label className="block text-xs font-semibold text-slate-600">Nombre<input value={form.name} required maxLength={80} autoFocus onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} /></label>
          <label className="block text-xs font-semibold text-slate-600">Correo<input type="email" value={form.email} required autoComplete="off" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputClass} /></label>
          <label className="block text-xs font-semibold text-slate-600">Contraseña inicial<input type="password" value={form.password} required minLength={8} autoComplete="new-password" onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className={inputClass} /></label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" disabled={saving || form.password.length < 8} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Agregando…' : 'Agregar'}</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => { setAdding(true); setNotice(null) }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary">
          <Icon name="plus" size={14} />Agregar administrador
        </button>
      )}
    </div>
  )
}
