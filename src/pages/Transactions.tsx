import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { formatCurrency } from '@/lib/color'

export function Transactions() {
  const { programId } = useParams<{ programId: string }>()
  const { transactions, isLoadingTransactions, loadTransactions } = useProgramsStore()

  useEffect(() => { if (programId) void loadTransactions(programId) }, [programId])

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      {isLoadingTransactions ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
      ) : transactions.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Sin transacciones todavía</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 text-left text-xs font-semibold uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Puntos</th>
              <th className="px-4 py-3">Descuento</th>
              <th className="px-4 py-3">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-3 capitalize">{tx.type.replace('_', ' ')}</td>
                <td className="px-4 py-3">{tx.customer?.name ?? tx.cardCustomerId}</td>
                <td className={`px-4 py-3 font-semibold ${tx.pointsDelta > 0 ? 'text-green-600' : tx.pointsDelta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                  {tx.pointsDelta > 0 ? '+' : ''}{tx.pointsDelta}
                </td>
                <td className="px-4 py-3">{tx.discountCents ? formatCurrency(tx.discountCents) : '—'}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(tx.createdAt).toLocaleString('es-MX')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
