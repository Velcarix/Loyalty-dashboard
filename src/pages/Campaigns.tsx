import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Icon } from '@/components/Icon'
import { useAuthStore } from '@/store/authStore'
import {
  DAY_SHORT, WEEK_ORDER, campaignStatus, campaignTypeFor, describeDays, describeHours, localDateToIso, multiplierLabel,
  type CampaignStatus,
} from '@/lib/campaigns'
import type { LoyaltyCampaign } from '@/types/loyalty'

const STATUS_STYLE: Record<CampaignStatus, { label: string; className: string }> = {
  active: { label: 'Activa', className: 'bg-emerald-50 text-emerald-700' },
  scheduled: { label: 'Programada', className: 'bg-sky-50 text-sky-700' },
  paused: { label: 'Pausada', className: 'bg-slate-100 text-slate-600' },
  ended: { label: 'Terminada', className: 'bg-slate-100 text-slate-500' },
}

interface FormState {
  name: string
  multiplier: number
  days: number[]
  timeStart: string
  timeEnd: string
  dateStart: string
  dateEnd: string
  branchIds: string[]
  notify: boolean
  notificationTitle: string
  notificationMessage: string
}

const EMPTY_FORM: FormState = {
  name: '',
  multiplier: 2,
  days: [],
  timeStart: '',
  timeEnd: '',
  dateStart: '',
  dateEnd: '',
  branchIds: [],
  notify: false,
  notificationTitle: '¡Visitas dobles!',
  notificationMessage: 'Durante la promoción cada visita cuenta doble en tu tarjeta.',
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export function Campaigns() {
  const { programId } = useParams<{ programId: string }>()
  const locations = useAuthStore(s => s.locations)
  const [campaigns, setCampaigns] = useState<LoyaltyCampaign[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    if (!programId) return
    try {
      setCampaigns(await api.get<LoyaltyCampaign[]>(`/api/v1/loyalty/programs/${programId}/campaigns`))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las campañas')
    }
  }

  useEffect(() => { void load() }, [programId])

  function branchName(id: string) {
    return locations.find(l => l.id === id)?.name ?? 'Sucursal'
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!programId || !form.name.trim()) return
    if ((form.timeStart && !form.timeEnd) || (!form.timeStart && form.timeEnd)) {
      setFormError('Pon la hora de inicio y la de fin, o deja las dos vacías'); return
    }
    if (form.timeStart && form.timeEnd && form.timeStart >= form.timeEnd) {
      setFormError('La hora de fin debe ser después de la de inicio'); return
    }
    if (form.dateStart && form.dateEnd && form.dateStart > form.dateEnd) {
      setFormError('La fecha de fin debe ser después de la de inicio'); return
    }
    setCreating(true)
    setFormError(null)
    try {
      await api.post(`/api/v1/loyalty/programs/${programId}/campaigns`, {
        type: campaignTypeFor({ hasTimeWindow: Boolean(form.timeStart), hasDates: Boolean(form.dateStart || form.dateEnd) }),
        name: form.name.trim(),
        multiplier: form.multiplier,
        daysOfWeek: form.days,
        timeWindowStart: form.timeStart || null,
        timeWindowEnd: form.timeEnd || null,
        startsAt: form.dateStart ? localDateToIso(form.dateStart, false) : null,
        endsAt: form.dateEnd ? localDateToIso(form.dateEnd, true) : null,
        applicableBranchIds: form.branchIds,
        notifyCustomers: form.notify,
        ...(form.notify ? { notificationTitle: form.notificationTitle.trim(), notificationMessage: form.notificationMessage.trim() } : {}),
      })
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la campaña')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(campaign: LoyaltyCampaign) {
    if (!programId) return
    setBusyId(campaign.id)
    try {
      await api.put(`/api/v1/loyalty/programs/${programId}/campaigns/${campaign.id}`, { isActive: !campaign.isActive })
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(campaign: LoyaltyCampaign) {
    if (!programId || !confirm(`¿Eliminar la campaña «${campaign.name}»? Las visitas que ya contaron doble se quedan igual.`)) return
    setBusyId(campaign.id)
    try {
      await api.delete(`/api/v1/loyalty/programs/${programId}/campaigns/${campaign.id}`)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  const toggleDay = (day: number) => setForm(f => ({ ...f, days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day] }))
  const toggleBranch = (id: string) => setForm(f => ({ ...f, branchIds: f.branchIds.includes(id) ? f.branchIds.filter(b => b !== id) : [...f.branchIds, id] }))
  const inputClass = 'mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none'

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <form onSubmit={handleCreate} className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-bold text-slate-950">Nueva campaña</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Mientras esté activa, cada visita cuenta varias veces en la tarjeta. Días y horario usan la zona horaria de tu negocio.</p>
        </div>

        <label className="block text-xs font-semibold text-slate-600">
          Nombre
          <input value={form.name} maxLength={60} required onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Martes de visitas dobles" className={inputClass} />
        </label>

        <div>
          <p className="text-xs font-semibold text-slate-600">Cada visita cuenta</p>
          <div className="mt-1 inline-flex rounded-xl border border-slate-200 p-1" role="radiogroup" aria-label="Multiplicador">
            {[2, 3].map(m => (
              <button key={m} type="button" role="radio" aria-checked={form.multiplier === m} onClick={() => setForm(f => ({ ...f, multiplier: m }))}
                className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${form.multiplier === m ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                x{m}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-600">Días <span className="font-normal text-slate-400">(ninguno = todos)</span></p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {WEEK_ORDER.map(day => (
              <button key={day} type="button" aria-pressed={form.days.includes(day)} onClick={() => toggleDay(day)}
                className={`min-w-11 rounded-lg border px-2 py-1.5 text-xs font-bold transition ${form.days.includes(day) ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {DAY_SHORT[day]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-600">Desde las<input type="time" value={form.timeStart} onChange={e => setForm(f => ({ ...f, timeStart: e.target.value }))} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-600">Hasta las<input type="time" value={form.timeEnd} onChange={e => setForm(f => ({ ...f, timeEnd: e.target.value }))} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-600">Empieza<input type="date" value={form.dateStart} onChange={e => setForm(f => ({ ...f, dateStart: e.target.value }))} className={inputClass} /></label>
          <label className="text-xs font-semibold text-slate-600">Termina<input type="date" value={form.dateEnd} onChange={e => setForm(f => ({ ...f, dateEnd: e.target.value }))} className={inputClass} /></label>
        </div>

        {locations.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-slate-600">Sucursales <span className="font-normal text-slate-400">(ninguna = todas)</span></p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {locations.map(l => (
                <button key={l.id} type="button" aria-pressed={form.branchIds.includes(l.id)} onClick={() => toggleBranch(l.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${form.branchIds.includes(l.id) ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {l.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.notify} onChange={e => setForm(f => ({ ...f, notify: e.target.checked }))} />
            Avisar a mis clientes al crearla
          </label>
          {form.notify && (
            <div className="mt-3 space-y-2">
              <input value={form.notificationTitle} maxLength={80} onChange={e => setForm(f => ({ ...f, notificationTitle: e.target.value }))} aria-label="Título del aviso" className={inputClass} />
              <textarea value={form.notificationMessage} maxLength={300} rows={2} onChange={e => setForm(f => ({ ...f, notificationMessage: e.target.value }))} aria-label="Mensaje del aviso" className={inputClass} />
            </div>
          )}
        </div>

        {formError && <p className="text-xs font-semibold text-red-600" role="alert">{formError}</p>}
        <button type="submit" disabled={creating || !form.name.trim()} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white transition hover:bg-primary-dark disabled:opacity-50">
          {creating ? 'Creando…' : 'Crear campaña'}
        </button>
      </form>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Tus campañas</p>
        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
        ) : !campaigns ? (
          <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon name="sparkles" size={20} /></span>
            <p className="text-sm font-bold text-slate-800">Aún no tienes campañas</p>
            <p className="mx-auto mt-1 max-w-[36ch] text-sm text-slate-500">Úsalas para mover tus días flojos: por ejemplo, visitas dobles los martes por la tarde.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {campaigns.map(c => {
              const status = STATUS_STYLE[campaignStatus(c)]
              return (
                <article key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-bold text-slate-900">
                        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-extrabold text-primary">{multiplierLabel(c.multiplier)}</span>
                        <span className="truncate">{c.name}</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{describeDays(c.daysOfWeek)} · {describeHours(c.timeWindowStart, c.timeWindowEnd)}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {c.startsAt || c.endsAt ? `${c.startsAt ? formatDate(c.startsAt) : 'Desde ya'} → ${c.endsAt ? formatDate(c.endsAt) : 'sin fin'}` : 'Sin fecha de fin'}
                        {c.applicableBranchIds.length > 0 && ` · ${c.applicableBranchIds.map(branchName).join(', ')}`}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button type="button" onClick={() => void handleToggle(c)} disabled={busyId === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                      <Icon name={c.isActive ? 'pause' : 'play'} size={14} />{c.isActive ? 'Pausar' : 'Reanudar'}
                    </button>
                    <button type="button" onClick={() => void handleDelete(c)} disabled={busyId === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      <Icon name="trash" size={14} />Eliminar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
