import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { AudienceFilterEditor } from '@/components/AudienceFilterEditor'
import type { AudienceFilter, NotificationChannel } from '@/types/loyalty'

const SEGMENT_LABELS: Record<string, string> = { active: 'Activos', at_risk: 'En riesgo', lapsed: 'Inactivos', vip: 'VIP' }
const STATUS_LABELS: Record<string, string> = { scheduled: 'Programada', sending: 'Enviando…', sent: 'Enviada', failed: 'Falló' }

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

export function Notifications() {
  const { programId } = useParams<{ programId: string }>()
  const { notifications, isLoadingNotifications, loadNotifications, previewAudience, sendNotification, getProgram } = useProgramsStore()

  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [appleWalletEnabled, setAppleWalletEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [filters, setFilters] = useState<AudienceFilter>({})
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<string>('')

  const customFieldOptions = (programId ? getProgram(programId)?.program.customFields : null) ?? []

  useEffect(() => { if (programId) void loadNotifications(programId) }, [programId])
  useEffect(() => { setPreviewCount(null) }, [filters])

  async function handlePreview() {
    if (!programId) return
    setPreviewing(true)
    try {
      const count = await previewAudience(programId, filters.segment, filters)
      setPreviewCount(count)
    } finally {
      setPreviewing(false)
    }
  }

  async function handleSend() {
    if (!programId || !title.trim() || !message.trim()) return
    const channels: NotificationChannel[] = [
      ...(appleWalletEnabled ? ['push' as const] : []),
      ...(emailEnabled ? ['email' as const] : []),
    ]
    if (channels.length === 0) { setResult('Selecciona al menos un canal'); return }
    setSending(true)
    setResult('')
    try {
      const notification = await sendNotification(programId, { title: title.trim(), message: message.trim(), channels, targetSegment: filters.segment, targetFilters: filters })
      setResult(`Enviado a ${notification.recipientCount} cliente(s) — ${notification.deliveredCount} recibieron el aviso.`)
      setTitle(''); setMessage(''); setFilters({}); setPreviewCount(null)
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
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Canales</label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={appleWalletEnabled} onChange={e => setAppleWalletEnabled(e.target.checked)} />
              Apple Wallet (banner en la tarjeta de quien ya la agregó a su Wallet)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={emailEnabled} onChange={e => setEmailEnabled(e.target.checked)} />
              Email (a quien dio su correo y aceptó recibir novedades)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" disabled />
              SMS (próximamente)
            </label>
          </div>
        </div>

        {result && <p className="text-sm text-gray-700">{result}</p>}
        <button
          onClick={handleSend}
          disabled={sending || !title.trim() || !message.trim()}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {sending ? 'Enviando…' : 'Enviar notificación'}
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
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{STATUS_LABELS[n.status] ?? n.status}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{n.message}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
                  <span>{describeAudience(n.targetSegment, n.targetFilters)}</span>
                  <span>· {n.recipientCount} destinatario(s)</span>
                  <span>· {n.deliveredCount} entregado(s)</span>
                  <span>· {new Date(n.createdAt).toLocaleString('es-MX')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
