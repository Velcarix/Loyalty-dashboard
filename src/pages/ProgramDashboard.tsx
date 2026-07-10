import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { formatCurrency } from '@/lib/color'

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

const PERIODS = [
  { key: 'today', label: 'Hoy', days: 1 },
  { key: 'week', label: 'Semana', days: 7 },
  { key: 'month', label: 'Mes', days: 30 },
  { key: 'year', label: 'Año', days: 365 },
]

export function ProgramDashboard() {
  const { programId } = useParams<{ programId: string }>()
  const { analytics, isLoadingAnalytics, loadAnalytics } = useProgramsStore()
  const [period, setPeriod] = useState('week')

  useEffect(() => {
    if (!programId) return
    const days = PERIODS.find(p => p.key === period)?.days ?? 7
    const end = new Date()
    const start = new Date(Date.now() - days * 86400000)
    void loadAnalytics(programId, start.toISOString(), end.toISOString())
  }, [programId, period])

  return (
    <div>
      <div className="mb-5 flex gap-2">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${period === p.key ? 'bg-primary text-white' : 'bg-white text-gray-600 shadow-sm'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoadingAnalytics ? (
        <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
      ) : !analytics ? (
        <div className="py-16 text-center text-sm text-gray-400">Sin datos todavía</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Clientes totales" value={analytics.totalCustomers} />
          <StatCard label="Nuevos en el período" value={analytics.newCustomersInPeriod} />
          <StatCard label="Activos" value={analytics.activeCustomers} />
          <StatCard label="En riesgo" value={analytics.atRiskCustomers} />
          <StatCard label="Inactivos" value={analytics.lapsedCustomers} />
          <StatCard label="VIP" value={analytics.vipCustomers} />
          <StatCard label="Puntos emitidos" value={analytics.totalPointsIssued} />
          <StatCard label="Descuentos aplicados" value={formatCurrency(analytics.totalDiscountCents)} />
        </div>
      )}
    </div>
  )
}
