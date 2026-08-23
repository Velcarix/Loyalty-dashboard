import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { RegistrationQrModal } from '@/components/RegistrationQrModal'
import { Icon } from '@/components/Icon'

const tabs = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'clientes', label: 'Clientes' },
  { to: 'rewards', label: 'Recompensas' },
  { to: 'transacciones', label: 'Transacciones' },
  { to: 'anomalias', label: 'Anomalías' },
  { to: 'datos-a-solicitar', label: 'Datos a solicitar' },
  { to: 'notificaciones', label: 'Notificaciones' },
]

export function ProgramDetailLayout() {
  const { programId } = useParams<{ programId: string }>()
  const { programs, loadPrograms, getProgram, toggleProgram } = useProgramsStore()
  const program = programId ? getProgram(programId) : undefined
  const [qrVisible, setQrVisible] = useState(false)
  const [togglingActive, setTogglingActive] = useState(false)

  useEffect(() => {
    if (programs.length === 0) void loadPrograms()
  }, [])

  async function handleToggleActive() {
    if (!programId || !program) return
    setTogglingActive(true)
    try {
      await toggleProgram(programId, !program.program.isActive)
    } finally {
      setTogglingActive(false)
    }
  }

  const bannerUrl = program?.program.bannerUrl
  const logoUrl = program?.program.logoUrl

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Link to="/programas" className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-primary transition hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/30"><Icon name="arrow-left" size={16} /> Programas</Link>

      {bannerUrl && (
        <div className="mt-4 h-28 w-full overflow-hidden rounded-2xl border border-slate-200 sm:h-36">
          <img src={bannerUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="mb-5 mt-4 flex flex-col gap-4 border-b border-slate-200 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt="" className="h-11 max-w-[9rem] shrink-0 object-contain" />
            )}
            <h1 className="truncate text-3xl font-bold tracking-tight text-slate-950">{program?.program.programName ?? 'Programa'}</h1>
          {program && !program.program.isActive && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-500">Pausado</span>
          )}
          </div>
          <p className="mt-2 text-sm text-slate-500">Gestiona rendimiento, clientes, recompensas y la distribución de tu programa.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {program && (
            <button
              onClick={handleToggleActive}
              disabled={togglingActive}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name={program.program.isActive ? 'pause' : 'play'} size={16} /> {togglingActive ? 'Actualizando…' : program.program.isActive ? 'Pausar' : 'Activar'}
            </button>
          )}
          <button
            onClick={() => setQrVisible(true)}
            disabled={!program}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="qrcode" size={16} /> QR de registro
          </button>
          <Link to={`/programas/${programId}/editar`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/30">
            <Icon name="edit" size={16} /> Editar
          </Link>
        </div>
      </div>

      {qrVisible && program && (
        <RegistrationQrModal program={program.program} onClose={() => setQrVisible(false)} />
      )}

      <nav aria-label="Secciones del programa" className="mb-6 overflow-x-auto border-b border-slate-200">
      <div className="flex min-w-max gap-1">
        {tabs.map(tab => (
          <NavLink
            key={tab.label}
            to={tab.to || '.'}
            end={tab.end}
            className={({ isActive }) =>
              `border-b-2 px-4 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${isActive ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-800'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>
      </nav>

      <Outlet />
    </div>
  )
}
