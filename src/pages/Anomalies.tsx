import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'

export function Anomalies() {
  const { programId } = useParams<{ programId: string }>()
  const { anomalies, isLoadingAnomalies, loadAnomalies } = useProgramsStore()

  useEffect(() => { if (programId) void loadAnomalies(programId) }, [programId])

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">Detección de patrones sospechosos de la última semana (cajeros con volumen alto, reversiones frecuentes, etc.)</p>
      {isLoadingAnomalies ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
      ) : anomalies.length === 0 ? (
        <div className="rounded-2xl bg-white py-10 text-center shadow-sm">
          <p className="mb-1 text-3xl">✅</p>
          <p className="text-sm text-gray-500">Sin anomalías detectadas</p>
        </div>
      ) : (
        <div className="space-y-2">
          {anomalies.map((a, i) => (
            <div key={i} className={`rounded-xl px-4 py-3 ${a.severity === 'high' ? 'bg-red-50' : 'bg-amber-50'}`}>
              <p className={`text-sm font-semibold ${a.severity === 'high' ? 'text-red-700' : 'text-amber-700'}`}>{a.description}</p>
              <p className="text-xs text-gray-500">{a.count} caso(s) · severidad {a.severity === 'high' ? 'alta' : 'media'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
