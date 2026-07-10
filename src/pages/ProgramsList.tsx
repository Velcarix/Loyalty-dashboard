import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { WalletPassPreview } from '@/components/WalletPassPreview'
import type { LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

export function ProgramsList() {
  const { programs, isLoading, loadPrograms } = useProgramsStore()

  useEffect(() => { void loadPrograms() }, [])

  return (
    <div className="mx-auto max-w-5xl px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programas</h1>
          <p className="text-sm text-gray-500">Tus tarjetas de lealtad</p>
        </div>
        <Link to="/programas/nuevo" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">+ Nuevo programa</Link>
      </div>

      {isLoading && programs.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">Cargando…</div>
      )}

      {!isLoading && programs.length === 0 && (
        <div className="rounded-2xl bg-white py-16 text-center shadow-sm">
          <p className="mb-2 text-4xl">🎫</p>
          <p className="mb-1 text-lg font-bold text-gray-900">Sin programas aún</p>
          <p className="mb-6 text-sm text-gray-500">Crea tu primera tarjeta de lealtad</p>
          <Link to="/programas/nuevo" className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold text-white">Crear programa</Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map(({ program, config }) => {
          const isPoints = program.type === 'points'
          const pc = isPoints ? config as LoyaltyPointsConfig : null
          const vc = !isPoints ? config as LoyaltyVisitsConfig : null
          return (
            <Link key={program.id} to={`/programas/${program.id}`} className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md">
              <WalletPassPreview program={program} config={config} />
              <div className="mt-3">
                <p className="truncate text-sm font-semibold text-gray-900">{program.programName}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {isPoints
                    ? `$${((pc?.minPurchaseCents ?? 0) / 100).toFixed(0)} mín · 1 pto = $${((pc?.centPerPoint ?? 0) / 100).toFixed(0)}`
                    : `${vc?.visitsTarget ?? '?'} visitas → ${vc?.rewardDescription ?? 'Premio'}`}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
