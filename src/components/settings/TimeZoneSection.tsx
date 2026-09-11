import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Icon } from '@/components/Icon'

const ZONES: Array<[string, string]> = [
  ['America/Mexico_City', 'Centro de México (CDMX, Guadalajara, Monterrey)'],
  ['America/Cancun', 'Quintana Roo'],
  ['America/Chihuahua', 'Chihuahua'],
  ['America/Mazatlan', 'Pacífico mexicano (Sinaloa, Nayarit, BCS)'],
  ['America/Hermosillo', 'Sonora'],
  ['America/Tijuana', 'Baja California'],
  ['America/Guatemala', 'Centroamérica'],
  ['America/Bogota', 'Colombia'],
  ['America/Lima', 'Perú'],
  ['America/Santiago', 'Chile'],
  ['America/Argentina/Buenos_Aires', 'Argentina'],
  ['America/New_York', 'EE. UU. — Este'],
  ['America/Los_Angeles', 'EE. UU. — Pacífico'],
  ['Europe/Madrid', 'España'],
]

export function TimeZoneSection({ value, onSaved }: { value: string | undefined; onSaved: () => Promise<unknown> }) {
  const current = value ?? 'America/Mexico_City'
  const [selected, setSelected] = useState(current)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setSelected(current) }, [current])

  const options = ZONES.some(([zone]) => zone === current) ? ZONES : [[current, current] as [string, string], ...ZONES]

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      await api.put('/api/v1/merchant', { timeZone: selected })
      await onSaved()
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">Se usa para los días y horarios de las campañas, la hora de envío de las automatizaciones y las gráficas del dashboard.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={selected} onChange={e => { setSelected(e.target.value); setSaved(false) }} aria-label="Zona horaria"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
          {options.map(([zone, label]) => <option key={zone} value={zone}>{label}</option>)}
        </select>
        <button type="button" onClick={() => void handleSave()} disabled={saving || selected === current} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-xs text-green-600"><Icon name="check" size={14} />Guardado</span>}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
