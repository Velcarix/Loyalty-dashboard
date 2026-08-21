import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { RegistrationQrModal } from '@/components/RegistrationQrModal'

const tabs = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'clientes', label: 'Clientes' },
  { to: 'rewards', label: 'Recompensas' },
  { to: 'transacciones', label: 'Transacciones' },
  { to: 'anomalias', label: 'Anomalías' },
  { to: 'datos-a-solicitar', label: 'Datos a solicitar' },
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

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Link to="/programas" className="text-sm text-primary">← Programas</Link>
      <div className="mb-4 mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">{program?.program.programName ?? 'Programa'}</h1>
          {program && !program.program.isActive && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase text-gray-500">Pausado</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {program && (
            <button
              onClick={handleToggleActive}
              disabled={togglingActive}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 disabled:opacity-50"
            >
              {togglingActive ? '…' : program.program.isActive ? 'Pausar' : 'Activar'}
            </button>
          )}
          <button
            onClick={() => setQrVisible(true)}
            disabled={!program}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600 disabled:opacity-50"
          >
            QR de registro
          </button>
          <Link to={`/programas/${programId}/editar`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600">
            Editar
          </Link>
        </div>
      </div>

      {qrVisible && program && (
        <RegistrationQrModal program={program.program} onClose={() => setQrVisible(false)} />
      )}

      <div className="mb-6 flex gap-1 border-b border-gray-200">
        {tabs.map(tab => (
          <NavLink
            key={tab.label}
            to={tab.to || '.'}
            end={tab.end}
            className={({ isActive }) =>
              `border-b-2 px-4 py-2 text-sm font-semibold ${isActive ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
