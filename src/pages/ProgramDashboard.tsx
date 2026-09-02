import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { Icon, type IconName } from '@/components/Icon'

function StatCard({ label, value, icon, tone, sub }: { label: string; value: string | number; icon: IconName; tone: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon name={icon} size={16} /></span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
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
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-950">Pulso del programa</p>
          <p className="mt-1 text-sm text-slate-500">Mide la actividad de tus clientes y detecta oportunidades de regreso.</p>
        </div>
        <div aria-label="Periodo" className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            aria-pressed={period === p.key}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${period === p.key ? 'bg-primary text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {p.label}
          </button>
        ))}
        </div>
      </div>

      {isLoadingAnalytics ? (
        <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">Actualizando métricas…</div>
      ) : !analytics ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="chart" size={23} /></span>
          <p className="text-sm font-bold text-slate-800">Aún no hay actividad para este periodo</p>
          <p className="mt-1 text-sm text-slate-500">Cuando tus clientes acumulen o canjeen, la verás aquí.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Clientes totales" value={analytics.totalCustomers} icon="user" tone="bg-blue-50 text-primary" />
          <StatCard label="Nuevos" value={analytics.newCustomersInPeriod} icon="plus" tone="bg-teal-50 text-teal-700" />
          <StatCard label="Activos" value={analytics.activeCustomers} icon="check" tone="bg-emerald-50 text-emerald-700" />
          <StatCard label="En riesgo" value={analytics.atRiskCustomers} icon="shield" tone="bg-amber-50 text-amber-700" />
          <StatCard label="Inactivos" value={analytics.lapsedCustomers} icon="pause" tone="bg-slate-100 text-slate-600" />
          <StatCard label="VIP" value={analytics.vipCustomers} icon="sparkles" tone="bg-violet-50 text-violet-700" />
        </div>
      )}
    </div>
  )
}
