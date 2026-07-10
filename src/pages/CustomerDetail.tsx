import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'

export function CustomerDetail() {
  const { programId, customerId } = useParams<{ programId: string; customerId: string }>()
  const { customers, transactions, loadCustomers, loadTransactions, adjustPoints } = useProgramsStore()
  const merchant = useAuthStore(s => s.merchant)
  const [delta, setDelta] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

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

  if (!customer) return <p className="py-10 text-center text-sm text-gray-400">Cargando cliente…</p>

  return (
    <div>
      <Link to={`/programas/${programId}/clientes`} className="text-sm text-primary">← Clientes</Link>
      <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm md:col-span-1">
          <h2 className="text-lg font-bold text-gray-900">{customer.name}</h2>
          <p className="text-sm text-gray-500">{customer.phone}</p>
          {customer.email && <p className="text-xs text-gray-400">{customer.email}</p>}

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
