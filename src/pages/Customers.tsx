import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useProgramsStore } from '@/store/programsStore'

export function Customers() {
  const { programId } = useParams<{ programId: string }>()
  const navigate = useNavigate()
  const { customers, isLoadingCustomers, loadCustomers, deleteCustomer } = useProgramsStore()
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => { if (programId) void loadCustomers(programId) }, [programId])

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  async function handleDelete(customerId: string, name: string) {
    if (!programId) return
    if (!confirm(`¿Eliminar a "${name}" y todo su historial de transacciones? Esta acción no se puede deshacer.`)) return
    setDeletingId(customerId)
    try {
      await deleteCustomer(programId, customerId)
    } catch (err: any) {
      alert(err?.message ?? 'No se pudo eliminar el cliente')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Buscar por nombre o teléfono…"
        className="mb-4 w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
      />
      {isLoadingCustomers ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Sin clientes todavía</p>
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Saldo</th>
                <th className="px-4 py-3">Segmento</th>
                <th className="px-4 py-3">Última actividad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      {c.visitsCount} visitas
                      {c.hasPendingReward && (
                        <span className="inline-flex text-amber-600">
                          <Icon name="gift" size={16} />
                          <span className="sr-only">Premio pendiente</span>
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{c.segment.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-gray-500">{c.lastActivityAt ? new Date(c.lastActivityAt).toLocaleDateString('es-MX') : 'Sin actividad'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => navigate(`/programas/${programId}/clientes/${c.id}`)}
                        title="Editar"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deletingId === c.id}
                        title="Eliminar"
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
