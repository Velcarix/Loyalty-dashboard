import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { Icon, type IconName } from '@/components/Icon'
import { ScanBarChart } from '@/components/ScanBarChart'
import {
  WEEKDAY_DISPLAY_ORDER, WEEKDAY_NAMES, WEEKDAY_SHORT,
  findExtremes, formatHour, formatHourRange, joinNames, toCsv,
} from '@/lib/metrics'
import type { RecentRegistration } from '@/types/loyalty'

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

function Panel({ title, description, action, className = '', children }: {
  title: string; description?: string; action?: ReactNode; className?: string; children: ReactNode
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-950">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Highlight({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="truncate text-sm font-bold text-slate-950" title={value}>{value}</p>
      <p className="text-xs text-slate-500">{detail}</p>
    </div>
  )
}

function EmptyPanel({ text }: { text: string }) {
  return <p className="py-10 text-center text-sm text-slate-400">{text}</p>
}

const scansLabel = (n: number) => `${n} ${n === 1 ? 'escaneo' : 'escaneos'}`

const PERIODS = [
  { key: 'today', label: 'Hoy', days: 1 },
  { key: 'week', label: 'Semana', days: 7 },
  { key: 'month', label: 'Mes', days: 30 },
  { key: 'year', label: 'Año', days: 365 },
]

function downloadRegistrationsCsv(rows: RecentRegistration[], periodLabel: string) {
  const csv = toCsv([
    ['Nombre', 'Correo', 'Teléfono', 'Acepta promociones', 'Fecha de registro'],
    ...rows.map(r => [
      r.name,
      r.email ?? '',
      r.phone,
      r.emailConsent ? 'Sí' : 'No',
      new Date(r.createdAt).toLocaleString('es-MX'),
    ]),
  ])
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `registros-${periodLabel.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

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

  const periodLabel = PERIODS.find(p => p.key === period)?.label ?? ''
  // En "Hoy" solo hay un día con datos: el más/menos escaneado no dice nada.
  const showWeekdays = period !== 'today'

  const scansByWeekday = analytics?.scansByWeekday ?? []
  const scansByHour = analytics?.scansByHour ?? []
  const topReturning = analytics?.topReturningCustomers ?? []
  const registrations = analytics?.recentRegistrations ?? []
  const weekdayExtremes = scansByWeekday.length === 7 ? findExtremes(scansByWeekday, WEEKDAY_DISPLAY_ORDER) : null
  const hourExtremes = scansByHour.length === 24 ? findExtremes(scansByHour) : null
  const withEmail = registrations.filter(r => r.email).length

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
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Clientes totales" value={analytics.totalCustomers} icon="user" tone="bg-blue-50 text-primary" />
            <StatCard label="Nuevos" value={analytics.newCustomersInPeriod} icon="plus" tone="bg-teal-50 text-teal-700" />
            <StatCard label="Escaneos" value={analytics.scansInPeriod ?? 0} icon="qrcode" tone="bg-sky-50 text-sky-700" sub={`Visitas registradas · ${periodLabel.toLowerCase()}`} />
            <StatCard label="Activos" value={analytics.activeCustomers} icon="check" tone="bg-emerald-50 text-emerald-700" />
            <StatCard label="En riesgo" value={analytics.atRiskCustomers} icon="shield" tone="bg-amber-50 text-amber-700" />
            <StatCard label="Inactivos" value={analytics.lapsedCustomers} icon="pause" tone="bg-slate-100 text-slate-600" />
            <StatCard label="VIP" value={analytics.vipCustomers} icon="sparkles" tone="bg-violet-50 text-violet-700" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {showWeekdays && (
              <Panel title="Escaneos por día de la semana" description="Qué días viene más y menos gente.">
                {!weekdayExtremes ? <EmptyPanel text="Sin escaneos en este periodo" /> : (
                  <>
                    <div className="mb-4 flex gap-2">
                      <Highlight
                        label="Día más fuerte"
                        value={joinNames(weekdayExtremes.maxIndices.map(i => WEEKDAY_NAMES[i]))}
                        detail={scansLabel(weekdayExtremes.maxValue)}
                      />
                      <Highlight
                        label="Día más flojo"
                        value={joinNames(weekdayExtremes.minIndices.map(i => WEEKDAY_NAMES[i]))}
                        detail={scansLabel(weekdayExtremes.minValue)}
                      />
                    </div>
                    <ScanBarChart
                      caption="Escaneos por día de la semana"
                      highlight={weekdayExtremes.maxIndices}
                      bars={WEEKDAY_DISPLAY_ORDER.map(i => ({ key: i, label: WEEKDAY_SHORT[i], fullLabel: WEEKDAY_NAMES[i], value: scansByWeekday[i] }))}
                    />
                  </>
                )}
              </Panel>
            )}

            <Panel
              title="Escaneos por hora"
              description={`Hora local${analytics.timeZone ? ` (${analytics.timeZone.replace(/_/g, ' ')})` : ''}.`}
              className={showWeekdays ? '' : 'lg:col-span-2'}
            >
              {!hourExtremes ? <EmptyPanel text="Sin escaneos en este periodo" /> : (
                <>
                  <div className="mb-4 flex gap-2">
                    <Highlight
                      label="Hora pico"
                      value={joinNames(hourExtremes.maxIndices.map(formatHourRange), 2)}
                      detail={scansLabel(hourExtremes.maxValue)}
                    />
                  </div>
                  <ScanBarChart
                    caption="Escaneos por hora del día"
                    highlight={hourExtremes.maxIndices}
                    labelEvery={3}
                    bars={scansByHour.map((value, h) => ({ key: h, label: formatHour(h).slice(0, 2), fullLabel: formatHourRange(h), value }))}
                  />
                </>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Panel title="Clientes que más vuelven" description={`Más visitas en el periodo · ${periodLabel.toLowerCase()}`}>
              {topReturning.length === 0 ? <EmptyPanel text="Sin visitas en este periodo" /> : (
                <ol className="divide-y divide-slate-100">
                  {topReturning.map((c, i) => (
                    <li key={c.customerId} className="flex items-center gap-3 py-2.5">
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${i < 3 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{c.name}</p>
                        <p className="truncate text-xs text-slate-500">{c.email ?? c.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-950">{c.visitsInPeriod} {c.visitsInPeriod === 1 ? 'visita' : 'visitas'}</p>
                        <p className="text-xs text-slate-400">{c.totalVisits} en total</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel
              title="Correos de nuevos registros"
              description={registrations.length === 0 ? undefined : `${withEmail} de ${registrations.length} dejaron correo${analytics.newCustomersInPeriod > registrations.length ? ` · mostrando los ${registrations.length} más recientes de ${analytics.newCustomersInPeriod}` : ''}`}
              action={registrations.length > 0 && (
                <button
                  onClick={() => downloadRegistrationsCsv(registrations, periodLabel)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <Icon name="upload" size={14} className="rotate-180" />
                  Exportar CSV
                </button>
              )}
            >
              {registrations.length === 0 ? <EmptyPanel text="Nadie se registró en este periodo" /> : (
                <>
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white text-left text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">Cliente</th>
                          <th className="py-2 pr-3">Correo</th>
                          <th className="py-2 text-right">Registro</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {registrations.map(r => (
                          <tr key={r.id}>
                            <td className="py-2 pr-3 font-semibold text-slate-900">{r.name}</td>
                            <td className="py-2 pr-3">
                              {r.email ? (
                                <span className="flex items-center gap-1.5">
                                  <span className="truncate text-slate-700">{r.email}</span>
                                  {r.emailConsent && (
                                    <span title="Aceptó recibir promociones" className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                      <Icon name="check" size={10} />Promos
                                    </span>
                                  )}
                                </span>
                              ) : <span className="text-slate-400">Sin correo</span>}
                            </td>
                            <td className="whitespace-nowrap py-2 text-right text-xs text-slate-500">
                              {new Date(r.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Manda promociones solo a quien tiene la etiqueta «Promos»: son los que aceptaron recibirlas.</p>
                </>
              )}
            </Panel>
          </div>
        </div>
      )}
    </div>
  )
}
