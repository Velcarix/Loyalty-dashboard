import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Icon, type IconName } from '@/components/Icon'
import { useProgramsStore } from '@/store/programsStore'
import type { AutomationRule, AutomationTrigger, NotificationChannel } from '@/types/loyalty'

const META: Record<AutomationTrigger, { title: string; description: string; icon: IconName }> = {
  birthday: {
    title: 'Cumpleaños',
    description: 'Se envía el día del cumpleaños del cliente a las 10:00, hora de tu negocio.',
    icon: 'gift',
  },
  inactivity: {
    title: 'Clientes que no regresan',
    description: 'Se envía una sola vez, cuando el cliente cumple los días indicados sin visitarte.',
    icon: 'pause',
  },
  reward_unlocked: {
    title: 'Premio desbloqueado',
    description: 'Se envía en cuanto el cliente completa las visitas de un premio.',
    icon: 'sparkles',
  },
  review_request: {
    title: 'Pedir reseña en Google',
    description: 'Se envía una sola vez por cliente, al registrar la visita número que elijas.',
    icon: 'check',
  },
}

const ORDER: AutomationTrigger[] = ['reward_unlocked', 'birthday', 'inactivity', 'review_request']

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-50 ${checked ? 'bg-primary' : 'bg-slate-300'}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

function RuleCard({ programId, rule, warning }: { programId: string; rule: AutomationRule; warning?: React.ReactNode }) {
  const [draft, setDraft] = useState(rule)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const meta = META[rule.trigger]
  const dirty = JSON.stringify(draft) !== JSON.stringify(rule)

  async function save(next: AutomationRule) {
    if (next.channels.length === 0) { setStatus({ tone: 'error', text: 'Elige al menos un canal' }); return }
    setSaving(true)
    setStatus(null)
    try {
      await api.put(`/api/v1/loyalty/programs/${programId}/notifications/rules/${rule.trigger}`, {
        isActive: next.isActive,
        ...(rule.trigger === 'inactivity' && next.inactivityDays ? { inactivityDays: next.inactivityDays } : {}),
        ...(rule.trigger === 'review_request' && next.afterVisits ? { afterVisits: next.afterVisits } : {}),
        titleTemplate: next.titleTemplate.trim(),
        messageTemplate: next.messageTemplate.trim(),
        channels: next.channels,
      })
      Object.assign(rule, next)
      setDraft({ ...next })
      setStatus({ tone: 'ok', text: next.isActive ? 'Guardado · activa' : 'Guardado · apagada' })
    } catch (err) {
      setStatus({ tone: 'error', text: err instanceof Error ? err.message : 'No se pudo guardar' })
    } finally {
      setSaving(false)
    }
  }

  function toggleChannel(channel: NotificationChannel, enabled: boolean) {
    setDraft(d => ({ ...d, channels: enabled ? [...new Set([...d.channels, channel])] : d.channels.filter(c => c !== channel) }))
  }

  return (
    <section className={`rounded-2xl border bg-white p-5 shadow-sm transition-colors ${draft.isActive ? 'border-primary/40' : 'border-slate-200'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${draft.isActive ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500'}`}>
          <Icon name={meta.icon} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-950">{meta.title}</h2>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{meta.description}</p>
        </div>
        {/* El switch guarda al instante: es lo que la gente espera de un switch. */}
        <Switch checked={draft.isActive} label={`Activar ${meta.title}`} disabled={saving} onChange={value => void save({ ...draft, isActive: value })} />
      </div>

      {warning && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">{warning}</div>}

      <div className="mt-4 grid gap-3">
        {rule.trigger === 'inactivity' && (
          <label className="text-xs font-semibold text-slate-600">
            Días sin visitar
            <input type="number" min={7} max={365} value={draft.inactivityDays ?? 30}
              onChange={e => setDraft(d => ({ ...d, inactivityDays: Number(e.target.value) || null }))}
              className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </label>
        )}
        {rule.trigger === 'review_request' && (
          <label className="text-xs font-semibold text-slate-600">
            Pedirla en la visita número
            <input type="number" min={1} max={100} value={draft.afterVisits ?? 3}
              onChange={e => setDraft(d => ({ ...d, afterVisits: Number(e.target.value) || null }))}
              className="mt-1 block w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          </label>
        )}
        <label className="text-xs font-semibold text-slate-600">
          Título
          <input value={draft.titleTemplate} maxLength={80} onChange={e => setDraft(d => ({ ...d, titleTemplate: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Mensaje
          <textarea value={draft.messageTemplate} maxLength={300} rows={2} onChange={e => setDraft(d => ({ ...d, messageTemplate: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </label>
        <p className="-mt-1 text-[11px] text-slate-400">Usa <code className="rounded bg-slate-100 px-1">{'{nombre}'}</code> y <code className="rounded bg-slate-100 px-1">{'{negocio}'}</code> para personalizar.</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.channels.includes('push')} onChange={e => toggleChannel('push', e.target.checked)} /> Wallet</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.channels.includes('email')} onChange={e => toggleChannel('email', e.target.checked)} /> Email (solo a quien aceptó)</label>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className={`text-xs font-semibold ${status?.tone === 'error' ? 'text-red-600' : 'text-emerald-700'}`} role="status">{status?.text ?? ''}</p>
        <button type="button" onClick={() => void save(draft)} disabled={saving || !dirty}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition hover:bg-primary-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:opacity-40">
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}

export function Automations() {
  const { programId } = useParams<{ programId: string }>()
  const program = useProgramsStore(s => (programId ? s.getProgram(programId)?.program : undefined))
  const [rules, setRules] = useState<AutomationRule[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!programId) return
    setRules(null)
    setError(null)
    api.get<AutomationRule[]>(`/api/v1/loyalty/programs/${programId}/notifications/rules`)
      .then(setRules)
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudieron cargar las automatizaciones'))
  }, [programId])

  if (!programId) return null

  function warningFor(trigger: AutomationTrigger): React.ReactNode {
    if (trigger === 'birthday' && program && !program.askBirthday) {
      return <>Tus clientes aún no dan su fecha de nacimiento. Actívala en <Link to="../datos-a-solicitar" className="font-bold underline">Datos a solicitar</Link>.</>
    }
    if (trigger === 'review_request') {
      if (!program?.businessInfo?.googleReviewUrl) {
        return <>Primero agrega tu enlace de reseñas en <Link to="../resenas-y-cercania" className="font-bold underline">Reseñas y cercanía</Link>.</>
      }
      return <>Google prohíbe dar premios o sellos a cambio de reseñas: solo pídela, sin ofrecer nada a cambio.</>
    }
    return undefined
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-sm font-bold text-slate-950">Automatizaciones</p>
        <p className="mt-1 text-sm text-slate-500">Mensajes que se envían solos a la tarjeta Wallet de tus clientes. Lo que se envía aparece en el historial de Notificaciones.</p>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>
      ) : !rules ? (
        <p className="py-10 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {ORDER.map(trigger => {
            const rule = rules.find(r => r.trigger === trigger)
            return rule ? <RuleCard key={trigger} programId={programId} rule={rule} warning={warningFor(trigger)} /> : null
          })}
        </div>
      )}
    </div>
  )
}
