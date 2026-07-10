import { useEffect } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'

const tabs = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'clientes', label: 'Clientes' },
  { to: 'rewards', label: 'Recompensas' },
  { to: 'transacciones', label: 'Transacciones' },
  { to: 'anomalias', label: 'Anomalías' },
]

export function ProgramDetailLayout() {
  const { programId } = useParams<{ programId: string }>()
  const { programs, loadPrograms, getProgram } = useProgramsStore()
  const program = programId ? getProgram(programId) : undefined

  useEffect(() => {
    if (programs.length === 0) void loadPrograms()
  }, [])

  return (
    <div className="mx-auto max-w-6xl px-8 py-8">
      <Link to="/programas" className="text-sm text-primary">← Programas</Link>
      <div className="mb-4 mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{program?.program.programName ?? 'Programa'}</h1>
        <Link to={`/programas/${programId}/editar`} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-600">
          Editar
        </Link>
      </div>

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
