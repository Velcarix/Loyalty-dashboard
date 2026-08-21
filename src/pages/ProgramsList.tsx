import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { WalletPassPreview } from '@/components/WalletPassPreview'
import { Icon } from '@/components/Icon'
import type { LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

export function ProgramsList() {
  const { programs, isLoading, loadPrograms } = useProgramsStore()

  useEffect(() => { void loadPrograms() }, [])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Loyalty</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Tus programas</h1>
          <p className="mt-2 text-sm text-slate-500">Diseña, publica y opera cada experiencia de lealtad desde Copo.</p>
        </div>
        <Link to="/programas/nuevo" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/30"><Icon name="plus" size={17} /> Nuevo programa</Link>
      </div>

      {isLoading && programs.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">Cargando tus programas…</div>
      )}

      {!isLoading && programs.length === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-16 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="program" size={26} /></span>
          <p className="mb-1 text-lg font-bold text-slate-950">Aún no tienes programas</p>
          <p className="mb-6 text-sm text-slate-500">Crea tu primera tarjeta de lealtad y publícala cuando esté lista.</p>
          <Link to="/programas/nuevo" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/30"><Icon name="plus" size={17} /> Crear programa</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map(({ program, config }) => {
          const isPoints = program.type === 'points'
          const pc = isPoints ? config as LoyaltyPointsConfig : null
          const vc = !isPoints ? config as LoyaltyVisitsConfig : null
          return (
            <Link key={program.id} to={`/programas/${program.id}`} className="group block rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-slate-900/5 focus:outline-none focus:ring-4 focus:ring-primary/20">
              <WalletPassPreview program={program} config={config} />
              <div className="mt-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-950">{program.programName}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                  {isPoints
                    ? `1 punto cada $${((pc?.pointsPerCent ?? 100) / 100).toFixed(2)}${(pc?.minPurchaseCents ?? 0) > 0 ? ` · compra mín. $${((pc?.minPurchaseCents ?? 0) / 100).toFixed(0)}` : ''}`
                    : `${vc?.visitsTarget ?? '?'} visitas · ${vc?.rewardDescription ?? 'Premio'}`}
                  </p>
                </div>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition group-hover:bg-primary group-hover:text-white"><Icon name="arrow-right" size={15} /></span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
