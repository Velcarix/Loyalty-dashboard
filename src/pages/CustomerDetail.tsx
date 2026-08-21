import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'

export function CustomerDetail() {
  const { programId, customerId } = useParams<{ programId: string; customerId: string }>()
  const navigate = useNavigate()
  const { customers, transactions, loadCustomers, loadTransactions, adjustPoints, updateCustomer, deleteCustomer } = useProgramsStore()
  const merchant = useAuthStore(s => s.merchant)
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!programId) return
    if (customers.length === 0) void loadCustomers(programId)
    void loadTransactions(programId)
  }, [programId])

  const customer = customers.find(c => c.id === customerId)
  const customerTxs = transactions.filter(t => t.cardCustomerId === customerId)

  async function handleAdjust() {
    if (!programId || !customerId) return
    const d = parseInt(delta)
    if (!d || note.trim().length < 3) return
    setSaving(true)
    try {
      await adjustPoints(programId, customerId, d, note.trim(), merchant?.email ?? 'admin')
      setDelta(''); setNote('')
    } finally {
      setSaving(false)
    }
  }

  function startEditing() {
    if (!customer) return
    setEditName(customer.name)
    setEditPhone(customer.phone)
    setEditEmail(customer.email ?? '')
    setEditError('')
    setIsEditing(true)
  }

  async function handleSaveEdit() {
    if (!programId || !customerId) return
    if (editName.trim().length < 2) { setEditError('El nombre es muy corto'); return }
    setSavingEdit(true)
    setEditError('')
    try {
      await updateCustomer(programId, customerId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
      })
      setIsEditing(false)
    } catch (err: any) {
      setEditError(err?.message ?? 'No se pudo guardar')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDelete() {
    if (!programId || !customerId || !customer) return
    if (!confirm(`¿Eliminar a "${customer.name}" y todo su historial de transacciones? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    try {
      await deleteCustomer(programId, customerId)
      navigate(`/programas/${programId}/clientes`)
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo eliminar el cliente')
      setDeleting(false)
    }
  }

  if (!customer) return <p className="py-10 text-center text-sm text-gray-400">Cargando cliente…</p>

  return (
    <div>
      <Link to={`/programas/${programId}/clientes`} className="text-sm text-primary">← Clientes</Link>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm md:col-span-1">
          {isEditing ? (
            <div className="space-y-2">
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nombre"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="Teléfono"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Email (opcional)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} disabled={savingEdit}
                  className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-white disabled:opacity-50">
                  {savingEdit ? 'Guardando…' : 'Guardar'}
                </button>
                <button onClick={() => setIsEditing(false)} disabled={savingEdit}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
                <p className="text-sm text-gray-500">{customer.phone}</p>
                {customer.email && <p className="text-xs text-gray-400">{customer.email}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={startEditing} title="Editar" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">✎</button>
                <button onClick={handleDelete} disabled={deleting} title="Eliminar" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">🗑</button>
              </div>
            </div>
          )}

          {customer.hasPendingReward && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              🎁 Premio pendiente: {customer.pendingRewardDescription}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 py-3">
              <p className="text-xl font-bold text-gray-900">{customer.pointsBalance}</p>
              <p className="text-xs text-gray-400">Puntos</p>
            </div>
            <div className="rounded-lg bg-gray-50 py-3">
              <p className="text-xl font-bold text-gray-900">{customer.totalEarnedPoints}</p>
              <p className="text-xs text-gray-400">Ganados</p>
            </div>
          </div>

          <div className="mt-5 space-y-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-700">Ajuste manual de puntos</p>
            <input value={delta} onChange={e => setDelta(e.target.value)} placeholder="+50 o -20"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Motivo del ajuste"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            <button
              onClick={handleAdjust}
              disabled={saving || !delta || note.trim().length < 3}
              className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Aplicar ajuste'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm md:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-gray-900">Historial de transacciones</h3>
          {customerTxs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Sin transacciones registradas</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {customerTxs.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 capitalize">{tx.type.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString('es-MX')}</p>
                  </div>
                  <p className={tx.pointsDelta > 0 ? 'font-bold text-green-600' : 'font-bold text-red-600'}>
                    {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta} pts
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
