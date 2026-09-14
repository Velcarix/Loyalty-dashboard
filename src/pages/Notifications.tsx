import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'
import { AudienceFilterEditor } from '@/components/AudienceFilterEditor'
import type { AudienceFilter } from '@/types/loyalty'

const SEGMENT_LABELS: Record<string, string> = { active: 'Activos', at_risk: 'En riesgo', lapsed: 'Inactivos', vip: 'VIP' }
const STATUS_LABELS: Record<string, string> = { scheduled: 'Programada', sending: 'Enviando…', sent: 'Enviada', failed: 'Falló' }
const TRIGGER_LABELS: Record<string, string> = {
  manual: 'Manual',
  birthday: 'Cumpleaños',
  inactivity: 'Inactividad',
  reward_unlocked: 'Premio',
  review_request: 'Reseña',
  campaign_launch: 'Campaña',
}

function describeAudience(segment?: string | null, filters?: AudienceFilter | null): string {
  const parts: string[] = []
  if (segment) parts.push(SEGMENT_LABELS[segment] ?? segment)
  if (filters?.gender) parts.push(filters.gender === 'male' ? 'Masculino' : 'Femenino')
  if (filters?.minAge != null || filters?.maxAge != null) {
    parts.push(`${filters.minAge ?? '0'}-${filters.maxAge ?? '120'} años`)
  }
  if (filters?.customFieldFilters?.length) parts.push(`${filters.customFieldFilters.length} campo(s) custom`)
  return parts.length > 0 ? parts.join(' · ') : 'Todos los clientes'
}

/** Valor para <input type="datetime-local"> en hora local. */
function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function Notifications() {
  const { programId } = useParams<{ programId: string }>()
  const { notifications, isLoadingNotifications, loadNotifications, previewAudience, sendNotification, getProgram } = useProgramsStore()
  const locations = useAuthStore(s => s.locations)

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [filters, setFilters] = useState<AudienceFilter>({})
  const [branchIds, setBranchIds] = useState<string[]>([])
  const [schedule, setSchedule] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string>('')

  const customFieldOptions = (programId ? getProgram(programId)?.program.customFields : null) ?? []

  useEffect(() => { if (programId) void loadNotifications(programId) }, [programId])
  useEffect(() => { setPreviewCount(null) }, [filters, branchIds])

  function toggleBranch(id: string) {
    setBranchIds(ids => ids.includes(id) ? ids.filter(b => b !== id) : [...ids, id])
  }

  async function handlePreview() {
    if (!programId) return
    setPreviewing(true)
    try {
      const count = await previewAudience(programId, filters.segment, filters, branchIds)
      setPreviewCount(count)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSend() {
    if (!programId || !title.trim() || !message.trim()) return
    let scheduledFor: string | undefined
    if (schedule) {
      const date = scheduledAt ? new Date(scheduledAt) : null
      if (!date || Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
        setResult('Elige una fecha y hora futuras'); return
      }
      scheduledFor = date.toISOString()
    }
    setSending(true)
    setResult('')
    try {
      const notification = await sendNotification(programId, {
        title: title.trim(), message: message.trim(), channels: ['push'],
        targetSegment: filters.segment, targetFilters: filters,
        branchIds: branchIds.length ? branchIds : undefined,
        scheduledFor,
      })
      setResult(scheduledFor
        ? `Programada para el ${new Date(scheduledFor).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })} — ${notification.recipientCount} cliente(s).`
        : `Enviado a ${notification.recipientCount} cliente(s) — ${notification.deliveredCount} recibieron el aviso.`)
      setTitle(''); setMessage(''); setFilters({}); setBranchIds([]); setPreviewCount(null); setSchedule(false); setScheduledAt('')
    } catch (err: any) {
      setResult(err?.message ?? 'No se pudo enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Nueva notificación</h2>
          <p className="mt-1 text-sm text-gray-500">Segmenta a tu público y manda el mensaje que quieras.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Público</label>
          <AudienceFilterEditor value={filters} onChange={setFilters} customFieldOptions={customFieldOptions} />
          {locations.length > 1 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-gray-600">Que hayan visitado <span className="font-normal text-gray-400">(ninguna = cualquier sucursal)</span></p>
              <div className="flex flex-wrap gap-1.5">
                {locations.map(l => (
                  <button key={l.id} type="button" aria-pressed={branchIds.includes(l.id)} onClick={() => toggleBranch(l.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${branchIds.includes(l.id) ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button type="button" onClick={handlePreview} disabled={previewing} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 disabled:opacity-50">
              {previewing ? 'Calculando…' : 'Ver cuántos califican'}
            </button>
            {previewCount != null && (
              <span className="text-xs font-semibold text-primary">{previewCount} cliente(s) califican</span>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} placeholder="Ej: 30% de descuento para +60"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Mensaje</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={500} placeholder="Ej: Muestra tu QR en caja y obtén 30% de descuento hoy."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          <p className="mt-1 text-[11px] text-gray-400">Puedes usar <code className="rounded bg-gray-100 px-1">{'{nombre}'}</code> para saludar a cada cliente por su nombre.</p>
        </div>

        <p className="text-xs text-gray-500">Llega como banner en la tarjeta Apple/Google Wallet de quien ya la agregó a su Wallet.</p>

        <div>
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            <input type="checkbox" checked={schedule} onChange={e => { setSchedule(e.target.checked); if (e.target.checked && !scheduledAt) setScheduledAt(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000))) }} />
            Programar para después
          </label>
          {schedule && (
            <input type="datetime-local" value={scheduledAt} min={toLocalInputValue(new Date())} onChange={e => setScheduledAt(e.target.value)} aria-label="Fecha y hora de envío"
              className="mt-2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
          )}
        </div>

        {result && <p className="text-sm text-gray-700" role="status">{result}</p>}
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {sending ? 'Enviando…' : schedule ? 'Programar notificación' : 'Enviar notificación'}
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">Historial</p>
        {isLoadingNotifications ? (
          <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
        ) : notifications.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">Sin notificaciones todavía</p>
        ) : (
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-gray-900">{n.title}</p>
                  <div className="flex shrink-0 gap-1">
                    {n.trigger !== 'manual' && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">{TRIGGER_LABELS[n.trigger] ?? n.trigger}</span>
                    )}
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{STATUS_LABELS[n.status] ?? n.status}</span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">{n.message}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                  <span>{describeAudience(n.targetSegment, n.targetFilters)}</span>
                  <span>· {n.recipientCount} destinatario(s)</span>
                  {n.status !== 'scheduled' && <span>· {n.deliveredCount} entregado(s)</span>}
                  <span>· {n.status === 'scheduled' && n.scheduledFor
                    ? `se enviará el ${new Date(n.scheduledFor).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}`
                    : new Date(n.sentAt ?? n.createdAt).toLocaleString('es-MX')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
