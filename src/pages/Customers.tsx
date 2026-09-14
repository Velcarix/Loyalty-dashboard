import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useProgramsStore } from '@/store/programsStore'
import type { LoyaltyCustomer, LoyaltyProgram } from '@/types/loyalty'

const GENDER_LABELS: Record<string, string> = { male: 'Masculino', female: 'Femenino' }

/** Datos extra que el programa pide en el registro (cumpleaños, género, campos propios), solo los que el cliente llenó. */
function extraDetails(c: LoyaltyCustomer, program: LoyaltyProgram | undefined): { label: string; value: string }[] {
  const details: { label: string; value: string }[] = []
  if (c.birthdayDate) {
    // Llega como medianoche UTC: formatear en UTC para no correr el día hacia atrás.
    const date = new Date(c.birthdayDate)
    if (!Number.isNaN(date.getTime())) {
      details.push({ label: 'Cumpleaños', value: date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) })
    }
  }
  if (c.gender) details.push({ label: 'Género', value: GENDER_LABELS[c.gender] ?? c.gender })
  for (const field of program?.customFields ?? []) {
    const value = c.customFieldValues?.[field.id]?.trim()
    if (value) details.push({ label: field.label, value })
  }
  return details
}

export function Customers() {
  const { programId } = useParams<{ programId: string }>()
  const navigate = useNavigate()
  const { customers, isLoadingCustomers, loadCustomers, deleteCustomer } = useProgramsStore()
  const program = useProgramsStore(s => (programId ? s.getProgram(programId)?.program : undefined))
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  async function handleExport() {
    if (!programId || !program) return
    setExporting(true)
    setExportError('')
    try {
      // exceljs pesa ~1 MB: se descarga solo cuando alguien exporta.
      const { exportCustomersToExcel } = await import('@/lib/customersExport')
      await exportCustomersToExcel(programId, program)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'No se pudo exportar')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { if (programId) void loadCustomers(programId) }, [programId])

  const query = search.trim().toLowerCase()
  const filtered = customers.filter(c =>
    !query || c.name.toLowerCase().includes(query) || c.phone.includes(query) || (c.email ?? '').toLowerCase().includes(query)
      || Object.values(c.customFieldValues ?? {}).some(v => v.toLowerCase().includes(query))
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono o correo…"
          className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting || !program || customers.length === 0}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-primary/40 hover:text-primary focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
        >
          <Icon name="download" size={16} />
          {exporting ? 'Preparando Excel…' : 'Exportar a Excel'}
        </button>
      </div>
      {exportError && <p className="mb-3 text-xs font-semibold text-red-600" role="alert">{exportError}</p>}
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
                    {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                    {extraDetails(c, program).map(d => (
                      <p key={d.label} className="text-xs text-gray-500"><span className="text-gray-400">{d.label}:</span> {d.value}</p>
                    ))}
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
