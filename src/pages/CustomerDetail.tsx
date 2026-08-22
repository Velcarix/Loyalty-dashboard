import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'

export function CustomerDetail() {
  const { programId, customerId } = useParams<{ programId: string; customerId: string }>()
  const navigate = useNavigate()
  const { customers, transactions, loadCustomers, loadTransactions, adjustPoints, updateCustomer, deleteCustomer, getProgram } = useProgramsStore()
  const merchant = useAuthStore(s => s.merchant)
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editBirthday, setEditBirthday] = useState('')
  const [editCustomFields, setEditCustomFields] = useState<Record<string, string>>({})
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const customFieldOptions = (programId ? getProgram(programId)?.program.customFields : null) ?? []

  useEffect(() => {
    if (!programId) return
    if (customers.length === 0) void loadCustomers(programId)
    void loadTransactions(programId)
  }, [programId])

  const customer = customers.find(c => c.id === customerId)
  const customerTxs = transactions.filter(t => t.cardCustomerId === customerId)

  useEffect(() => {
    if (!customer) return
    setEditName(customer.name)
    setEditPhone(customer.phone)
    setEditEmail(customer.email ?? '')
    setEditGender(customer.gender ?? '')
    setEditBirthday(customer.birthdayDate ?? '')
    setEditCustomFields(customer.customFieldValues ?? {})
    setEditError('')
  }, [customer?.id])

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

  async function handleSaveEdit() {
    if (!programId || !customerId) return
    if (editName.trim().length < 2) { setEditError('El nombre es muy corto'); return }
    setSavingEdit(true)
    setEditError('')
    setSaved(false)
    try {
      await updateCustomer(programId, customerId, {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        gender: editGender || null,
        birthdayDate: editBirthday || null,
        customFieldValues: Object.keys(editCustomFields).length > 0 ? editCustomFields : null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Editar cliente</h2>
            <button onClick={handleDelete} disabled={deleting} title="Eliminar cliente"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
              <Icon name="trash" size={16} />
            </button>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Nombre completo</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Teléfono</label>
              <input value={editPhone} onChange={e => setEditPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Email</label>
              <input value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="Opcional"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Género</label>
              <select value={editGender} onChange={e => setEditGender(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
                <option value="">Sin especificar</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha de nacimiento</label>
              <input type="date" value={editBirthday} onChange={e => setEditBirthday(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>

            {customFieldOptions.map(field => (
              <div key={field.id}>
                <label className="mb-1 block text-xs font-semibold text-gray-600">{field.label}</label>
                <input
                  value={editCustomFields[field.id] ?? ''}
                  onChange={e => setEditCustomFields(f => ({ ...f, [field.id]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            ))}

            {editError && <p className="text-xs text-red-600">{editError}</p>}
            <button onClick={handleSaveEdit} disabled={savingEdit}
              className="w-full rounded-lg bg-primary py-2 text-xs font-bold text-white disabled:opacity-50">
              {savingEdit ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar'}
            </button>
          </div>

          {customer.hasPendingReward && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
              <Icon name="gift" size={16} className="mt-0.5 shrink-0" />
              <span>Premio pendiente: {customer.pendingRewardDescription}</span>
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
