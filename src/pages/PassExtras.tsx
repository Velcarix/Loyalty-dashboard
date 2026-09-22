import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'
import { SHOW_GOOGLE_REVIEWS } from '@/lib/featureFlags'
import type { LoyaltyBusinessInfo } from '@/types/loyalty'

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export function PassExtras() {
  const { programId } = useParams<{ programId: string }>()
  const { getProgram, updateProgram, programs } = useProgramsStore()
  const locations = useAuthStore(s => s.locations)
  const program = programId ? getProgram(programId)?.program : undefined

  const [reviewUrl, setReviewUrl] = useState('')
  const [geoEnabled, setGeoEnabled] = useState(false)
  const [relevantText, setRelevantText] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!program) return
    setReviewUrl(program.businessInfo?.googleReviewUrl ?? '')
    setGeoEnabled(program.businessInfo?.geo?.enabled ?? false)
    setRelevantText(program.businessInfo?.geo?.relevantText ?? '')
  }, [program?.id, programs])

  if (!programId || !program) return <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>

  const locationsWithCoords = locations.filter(l => l.latitude != null && l.longitude != null)
  const reviewUrlInvalid = reviewUrl.trim() !== '' && !isHttpsUrl(reviewUrl.trim())

  async function handleSave() {
    if (!programId || !program || reviewUrlInvalid) return
    setSaving(true)
    setStatus(null)
    // El PUT reemplaza businessInfo completo: se parte de lo guardado (diseño, etc.).
    const next: LoyaltyBusinessInfo = { ...(program.businessInfo ?? {}) }
    if (reviewUrl.trim()) next.googleReviewUrl = reviewUrl.trim()
    else delete next.googleReviewUrl
    next.geo = { enabled: geoEnabled, ...(relevantText.trim() ? { relevantText: relevantText.trim() } : {}) }
    try {
      await updateProgram(programId, { businessInfo: next })
      setStatus({ tone: 'ok', text: 'Guardado. Las tarjetas ya emitidas se actualizan solas en unos minutos.' })
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo guardar' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {SHOW_GOOGLE_REVIEWS && (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold text-slate-950">Reseñas en Google</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Tu enlace aparece en la tarjeta como «Déjanos tu reseña en Google», y la automatización de reseñas lo usa para pedirla.
          Lo encuentras en tu perfil de Google Business → <strong>Pedir reseñas</strong>.
        </p>
        <div className="mt-3 flex gap-2">
          <input value={reviewUrl} onChange={e => setReviewUrl(e.target.value)} placeholder="https://g.page/r/…/review" inputMode="url"
            aria-invalid={reviewUrlInvalid}
            className={`min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none ${reviewUrlInvalid ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-primary'}`} />
          {reviewUrl.trim() && !reviewUrlInvalid && (
            <a href={reviewUrl.trim()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50">
              <Icon name="external" size={14} />Probar
            </a>
          )}
        </div>
        {reviewUrlInvalid && <p className="mt-1 text-xs text-red-600">Pega el enlace completo, empezando con https://</p>}
        <p className="mt-3 text-xs text-slate-500">
          Para enviarla automáticamente, activa «Pedir reseña en Google» en <Link to="../automatizaciones" className="font-bold text-primary underline-offset-2 hover:underline">Automatizaciones</Link>.
          No ofrezcas premios a cambio: Google lo prohíbe.
        </p>
      </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-950">Aviso de cercanía <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Opcional</span></h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Cuando un cliente con iPhone pase cerca de una de tus sucursales, su tarjeta aparece en la pantalla de bloqueo.
              iOS decide cuándo mostrarla; nosotros no rastreamos la ubicación de nadie. Solo Apple Wallet.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={geoEnabled} aria-label="Activar aviso de cercanía" onClick={() => setGeoEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 ${geoEnabled ? 'bg-primary' : 'bg-slate-300'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${geoEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {geoEnabled && (
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Texto en la pantalla de bloqueo
              <input value={relevantText} maxLength={80} onChange={e => setRelevantText(e.target.value)}
                placeholder={`Estás cerca de ${program.programName}. Muestra tu tarjeta.`}
                className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </label>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">Sucursales con ubicación ({locationsWithCoords.length} de {locations.length}{locationsWithCoords.length > 10 ? ' · Apple usa las primeras 10' : ''})</p>
              <ul className="mt-2 space-y-1">
                {locations.map(l => {
                  const ready = l.latitude != null && l.longitude != null
                  return (
                    <li key={l.id} className="flex items-center gap-2 text-sm">
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${ready ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                        {ready ? <Icon name="check" size={10} /> : <Icon name="x" size={10} />}
                      </span>
                      <span className={ready ? 'text-slate-800' : 'text-slate-500'}>{l.name}</span>
                      {!ready && <span className="text-xs text-slate-400">sin coordenadas</span>}
                    </li>
                  )
                })}
              </ul>
              {locationsWithCoords.length === 0 && (
                <p className="mt-2 text-xs font-semibold text-amber-800">Sin coordenadas no hay nada que avisar. Agrégalas en <Link to="/ajustes" className="underline">Ajustes → Sucursales</Link>.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center justify-end gap-3">
        {status && <p className={`text-xs font-semibold ${status.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`} role="status">{status.text}</p>}
        <button type="button" onClick={() => void handleSave()} disabled={saving || reviewUrlInvalid}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
