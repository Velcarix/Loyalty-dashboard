import { useState } from 'react'
import { api } from '@/lib/api'
import { Icon } from '@/components/Icon'
import { formatCoordinates, isShortMapsLink, parseCoordinates, type Coordinates } from '@/lib/maps'
import type { MerchantLocation } from '@/types/loyalty'

interface Draft {
  name: string
  address: string
  coordinatesText: string
}

function draftFrom(location?: MerchantLocation): Draft {
  const hasCoords = location?.latitude != null && location?.longitude != null
  return {
    name: location?.name ?? '',
    address: location?.address ?? '',
    coordinatesText: hasCoords ? formatCoordinates({ latitude: location!.latitude!, longitude: location!.longitude! }) : '',
  }
}

function LocationForm({ initial, onCancel, onSave, submitLabel }: {
  initial: Draft
  onCancel: () => void
  onSave: (data: { name: string; address: string | null } & { latitude: number | null; longitude: number | null }) => Promise<void>
  submitLabel: string
}) {
  const [draft, setDraft] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = draft.coordinatesText.trim()
  const parsed: Coordinates | null = trimmed ? parseCoordinates(trimmed) : null
  const coordsError = trimmed && !parsed
    ? isShortMapsLink(trimmed)
      ? 'Los enlaces cortos no traen coordenadas: ábrelo y copia la dirección completa de la barra, o pega «latitud, longitud».'
      : 'No encontramos coordenadas. Pega el enlace de Google Maps de tu negocio o «latitud, longitud».'
    : null

  function useCurrentPosition() {
    if (!navigator.geolocation) { setError('Tu navegador no permite obtener la ubicación'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      position => {
        setDraft(d => ({ ...d, coordinatesText: formatCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude }) }))
        setLocating(false)
      },
      () => { setError('No pudimos obtener tu ubicación. Revisa el permiso del navegador.'); setLocating(false) },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.name.trim() || coordsError) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: draft.name.trim(),
        address: draft.address.trim() || null,
        latitude: parsed?.latitude ?? null,
        longitude: parsed?.longitude ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-primary/30 bg-primary/[0.03] p-3">
      <label className="block text-xs font-semibold text-slate-600">Nombre<input value={draft.name} maxLength={60} required autoFocus onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} className={inputClass} placeholder="Sucursal Centro" /></label>
      <label className="block text-xs font-semibold text-slate-600">Dirección <span className="font-normal text-slate-400">(opcional)</span><input value={draft.address} maxLength={300} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))} className={inputClass} /></label>
      <div>
        <label className="block text-xs font-semibold text-slate-600" htmlFor="location-coords">Ubicación <span className="font-normal text-slate-400">(opcional — para el aviso de cercanía en Apple Wallet)</span></label>
        <div className="mt-1 flex gap-2">
          <input id="location-coords" value={draft.coordinatesText} onChange={e => setDraft(d => ({ ...d, coordinatesText: e.target.value }))}
            placeholder="Enlace de Google Maps o 19.43260, -99.13320" aria-invalid={Boolean(coordsError)}
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none ${coordsError ? 'border-red-300' : 'border-slate-200 focus:border-primary'}`} />
          <button type="button" onClick={useCurrentPosition} disabled={locating} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {locating ? 'Buscando…' : 'Usar mi ubicación'}
          </button>
        </div>
        {coordsError ? <p className="mt-1 text-xs text-red-600">{coordsError}</p>
          : parsed ? <p className="mt-1 text-xs text-emerald-700">Ubicación: {formatCoordinates(parsed)}</p> : null}
      </div>
      {error && <p className="text-xs font-semibold text-red-600" role="alert">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
        <button type="submit" disabled={saving || !draft.name.trim() || Boolean(coordsError)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Guardando…' : submitLabel}</button>
      </div>
    </form>
  )
}

export function LocationsSection({ locations, onChanged }: { locations: MerchantLocation[]; onChanged: () => Promise<unknown> }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleRemove(location: MerchantLocation) {
    if (!confirm(`¿Dar de baja «${location.name}»? Sus visitas pasadas se conservan en la analítica.`)) return
    setRemovingId(location.id)
    setError(null)
    try {
      await api.delete(`/api/v1/merchant/locations/${location.id}`)
      await onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs leading-5 text-gray-500">Las visitas se atribuyen a la sucursal del teléfono de Mostrador que las registra. Así puedes comparar sucursales en el dashboard y segmentar avisos.</p>
      <ul className="divide-y divide-slate-100">
        {locations.map(location => (
          <li key={location.id} className="py-2.5">
            {editingId === location.id ? (
              <LocationForm
                initial={draftFrom(location)}
                submitLabel="Guardar"
                onCancel={() => setEditingId(null)}
                onSave={async data => {
                  await api.put(`/api/v1/merchant/locations/${location.id}`, data)
                  await onChanged()
                  setEditingId(null)
                }}
              />
            ) : (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{location.name}</p>
                  {location.address && <p className="truncate text-xs text-slate-500">{location.address}</p>}
                  <p className={`mt-0.5 text-[11px] font-semibold ${location.latitude != null ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {location.latitude != null && location.longitude != null ? `Con ubicación · ${formatCoordinates({ latitude: location.latitude, longitude: location.longitude })}` : 'Sin ubicación'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => { setAdding(false); setEditingId(location.id) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar" aria-label={`Editar ${location.name}`}><Icon name="edit" size={16} /></button>
                  {locations.length > 1 && (
                    <button type="button" onClick={() => void handleRemove(location)} disabled={removingId === location.id} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50" title="Dar de baja" aria-label={`Dar de baja ${location.name}`}><Icon name="trash" size={16} /></button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{error}</p>}
      {adding ? (
        <div className="mt-3">
          <LocationForm
            initial={draftFrom()}
            submitLabel="Agregar"
            onCancel={() => setAdding(false)}
            onSave={async data => {
              await api.post('/api/v1/merchant/locations', data)
              await onChanged()
              setAdding(false)
            }}
          />
        </div>
      ) : (
        <button type="button" onClick={() => { setEditingId(null); setAdding(true) }} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:border-primary hover:text-primary">
          <Icon name="plus" size={14} />Agregar sucursal
        </button>
      )}
    </div>
  )
}
