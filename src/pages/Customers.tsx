import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useProgramsStore } from '@/store/programsStore'

export function Customers() {
  const { programId } = useParams<{ programId: string }>()
  const { customers, isLoadingCustomers, loadCustomers } = useProgramsStore()
  const [search, setSearch] = useState('')

  useEffect(() => { if (programId) void loadCustomers(programId) }, [programId])

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

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
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/programas/${programId}/clientes/${c.id}`} className="font-semibold text-gray-900 hover:text-primary">{c.name}</Link>
                    <p className="text-xs text-gray-400">{c.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      {c.pointsBalance} pts
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
