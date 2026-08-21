import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Icon } from '@/components/Icon'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

type MostradorDevice = {
  id: string
  label: string | null
  createdAt: string
  lastUsedAt: string | null
}

type MostradorPairingCode = {
  code: string
  expiresAt: string
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

function LocationRow({ location, onRenamed }: { location: { id: string; name: string }; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.put(`/api/v1/merchant/locations/${location.id}`, { name: name.trim() })
      onRenamed()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{location.name}</span>
      <button onClick={() => setEditing(true)} className="text-xs text-primary">Renombrar</button>
    </div>
  )
}

function formatPairingCode(code: string): string {
  return code.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatConnectedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

function formatLastUsedAt(value: string | null): string {
  if (!value) return 'Nunca'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible'
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'Hace unos segundos'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `Hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Hace ${days} día${days === 1 ? '' : 's'}`
  return formatConnectedAt(value)
}

function isDormantDevice(value: string | null): boolean {
  if (!value) return true
  const lastUsedAt = new Date(value).getTime()
  return Number.isNaN(lastUsedAt) || Date.now() - lastUsedAt > 30 * 24 * 60 * 60 * 1000
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

function PairingQr({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!canvasRef.current || !code) return
    let cancelled = false
    setFailed(false)
    void QRCode.toCanvas(canvasRef.current, `https://mostrador.copopos.com/#code=${code}`, {
      width: 172,
      margin: 1,
      color: { dark: '#0B132B', light: '#FFFFFF' },
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [code])

  if (failed) {
    return <p className="mx-auto max-w-[31ch] rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-amber-800" role="alert">No pudimos crear el QR. Puedes escribir el código de arriba en el teléfono.</p>
  }

  return <canvas ref={canvasRef} className="mx-auto rounded-xl border border-slate-100 bg-white p-2" aria-label="Código QR para conectar este teléfono" />
}

export function Settings() {
  const { merchant, locations, posLink, refreshProfile } = useAuthStore()
  const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [sessionSeconds, setSessionSeconds] = useState(90)
  const [savingSession, setSavingSession] = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const [mostradorDevices, setMostradorDevices] = useState<MostradorDevice[]>([])
  const [loadingMostradorDevices, setLoadingMostradorDevices] = useState(true)
  const [mostradorDevicesError, setMostradorDevicesError] = useState<string | null>(null)
  const [mostradorModalOpen, setMostradorModalOpen] = useState(false)
  const [mostradorLabel, setMostradorLabel] = useState('Teléfono')
  const [mostradorPairing, setMostradorPairing] = useState<MostradorPairingCode | null>(null)
  const [mostradorPairingError, setMostradorPairingError] = useState<string | null>(null)
  const [generatingMostradorCode, setGeneratingMostradorCode] = useState(false)
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null)
  const [pairingSecondsLeft, setPairingSecondsLeft] = useState(0)
  const mostradorConnectButtonRef = useRef<HTMLButtonElement>(null)
  const mostradorDialogRef = useRef<HTMLDivElement>(null)
  const mostradorLabelInputRef = useRef<HTMLInputElement>(null)
  const mostradorPairingResultRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void refreshProfile(); void loadMostradorDevices() }, [])
  useEffect(() => {
    if (merchant) setSessionSeconds(merchant.mostradorSessionSeconds)
  }, [merchant?.mostradorSessionSeconds])
  useEffect(() => {
    if (!mostradorPairing) {
      setPairingSecondsLeft(0)
      return
    }
    const update = () => setPairingSecondsLeft(Math.max(0, Math.ceil((new Date(mostradorPairing.expiresAt).getTime() - Date.now()) / 1000)))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [mostradorPairing?.expiresAt])
  useEffect(() => {
    if (!mostradorModalOpen) return
    const frame = window.requestAnimationFrame(() => {
      if (mostradorPairing) mostradorPairingResultRef.current?.focus()
      else mostradorLabelInputRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [mostradorModalOpen, mostradorPairing, pairingSecondsLeft === 0])
  useEffect(() => {
    if (!mostradorModalOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMostradorModal()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [mostradorModalOpen])

  async function loadMostradorDevices() {
    setLoadingMostradorDevices(true)
    setMostradorDevicesError(null)
    try {
      const data = await api.get<MostradorDevice[]>('/api/v1/integrations/pos/mostrador/devices')
      setMostradorDevices(Array.isArray(data) ? data : [])
    } catch (error) {
      setMostradorDevicesError(errorMessage(error, 'No pudimos cargar los teléfonos conectados.'))
    } finally {
      setLoadingMostradorDevices(false)
    }
  }

  async function handleSaveSession() {
    setSavingSession(true)
    setSessionSaved(false)
    try {
      await api.put('/api/v1/merchant', { mostradorSessionSeconds: sessionSeconds })
      await refreshProfile()
      setSessionSaved(true)
    } finally {
      setSavingSession(false)
    }
  }

  async function handleGenerateCode() {
    setGenerating(true)
    try {
      const data = await api.post<{ code: string; expiresAt: string }>('/api/v1/integrations/pos/code')
      setPairingCode(data)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke() {
    if (!confirm('¿Seguro que quieres desvincular tu POS?')) return
    setRevoking(true)
    try {
      await api.delete('/api/v1/integrations/pos/link')
      await refreshProfile()
    } finally {
      setRevoking(false)
    }
  }

  function openMostradorModal() {
    setMostradorLabel('Teléfono')
    setMostradorPairing(null)
    setMostradorPairingError(null)
    setMostradorModalOpen(true)
  }

  function closeMostradorModal() {
    setMostradorModalOpen(false)
    setMostradorPairing(null)
    setMostradorPairingError(null)
    void loadMostradorDevices()
    window.requestAnimationFrame(() => mostradorConnectButtonRef.current?.focus())
  }

  function handleMostradorModalKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMostradorModal()
      return
    }
    if (event.key !== 'Tab' || !mostradorDialogRef.current) return

    const focusable = Array.from(mostradorDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
      .filter(element => !element.hasAttribute('hidden') && element.offsetParent !== null)
    if (focusable.length === 0) return

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function handleGenerateMostradorCode() {
    setGeneratingMostradorCode(true)
    setMostradorPairingError(null)
    try {
      const data = await api.post<MostradorPairingCode>('/api/v1/integrations/pos/mostrador/code', { label: mostradorLabel.trim() || 'Teléfono' })
      setMostradorPairing(data)
    } catch (error) {
      setMostradorPairingError(errorMessage(error, 'No pudimos generar el código. Intenta de nuevo.'))
    } finally {
      setGeneratingMostradorCode(false)
    }
  }

  async function handleRevokeMostradorDevice(device: MostradorDevice) {
    const label = device.label || 'este teléfono'
    if (!confirm(`El teléfono «${label}» dejará de poder registrar visitas. Esto no borra ninguna visita ya registrada.`)) return
    setRevokingDeviceId(device.id)
    setMostradorDevicesError(null)
    try {
      await api.delete(`/api/v1/integrations/pos/mostrador/devices/${device.id}`)
      await loadMostradorDevices()
    } catch (error) {
      setMostradorDevicesError(errorMessage(error, 'No pudimos revocar el teléfono. Intenta de nuevo.'))
    } finally {
      setRevokingDeviceId(null)
    }
  }

  const pairingExpired = Boolean(mostradorPairing) && pairingSecondsLeft === 0
  const pairingMinutes = Math.floor(pairingSecondsLeft / 60)
  const pairingSeconds = String(pairingSecondsLeft % 60).padStart(2, '0')
  const authorizedDevicesLabel = loadingMostradorDevices
    ? 'Actualizando…'
    : `${mostradorDevices.length} ${mostradorDevices.length === 1 ? 'teléfono autorizado' : 'teléfonos autorizados'}`

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Ajustes</h1>

      <SectionCard title="Cuenta y negocio">
        <p className="font-semibold text-gray-900">{merchant?.businessName}</p>
        <p className="text-xs text-gray-500">{merchant?.email}</p>
        {merchant?.vertical && <p className="mt-1 text-xs text-gray-400">Giro: {merchant.vertical}</p>}
        <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase text-primary">{merchant?.plan ?? 'trial'}</span>
      </SectionCard>

      <SectionCard title="Ubicaciones">
        {locations.length === 0 ? <p className="text-sm text-gray-400">Sin ubicaciones</p> : (
          locations.map(l => <LocationRow key={l.id} location={l} onRenamed={refreshProfile} />)
        )}
      </SectionCard>

      <SectionCard title="Mostrador de visitas">
        <p className="mb-3 text-xs text-gray-500">
          Segundos que la sesión de un cliente queda desbloqueada en el Mostrador antes de pedir identificarse de nuevo.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={10}
            max={600}
            value={sessionSeconds}
            onChange={e => setSessionSeconds(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          />
          <span className="text-xs text-gray-500">segundos</span>
          <button
            onClick={handleSaveSession}
            disabled={savingSession || sessionSeconds < 10 || sessionSeconds > 600}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {savingSession ? 'Guardando…' : 'Guardar'}
          </button>
          {sessionSaved && <span className="inline-flex items-center gap-1 text-xs text-green-600"><Icon name="check" size={14} />Guardado</span>}
        </div>
      </SectionCard>

      <SectionCard title="Dispositivos de mostrador">
        <div className="mt-4 rounded-xl bg-brand-navy px-4 py-4 text-white sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-signal">
                <Icon name="qrcode" size={20} />
              </span>
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-signal">Acceso de caja</p>
                <p className="mt-1 max-w-md text-sm leading-5 text-slate-200">Cada teléfono se autoriza y revoca por separado. Así sabes exactamente qué equipo puede registrar visitas.</p>
              </div>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/90">{authorizedDevicesLabel}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-xs leading-5 text-gray-500">Revisa el último uso para retirar accesos que ya no se ocupan.</p>
          <button ref={mostradorConnectButtonRef} type="button" onClick={openMostradorModal} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-[background-color,transform,box-shadow] duration-150 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[.97]">
            <Icon name="qrcode" size={16} />
            Conectar un teléfono
          </button>
        </div>

        <div className="mt-4">
          {loadingMostradorDevices ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-5" role="status">
              <p className="text-sm font-semibold text-slate-600">Cargando teléfonos conectados…</p>
              <p className="mt-1 text-xs text-slate-500">Estamos revisando los accesos autorizados.</p>
            </div>
          ) : mostradorDevicesError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-700" role="alert">
              <p>{mostradorDevicesError}</p>
              <button type="button" onClick={() => void loadMostradorDevices()} className="mt-2 min-h-11 text-xs font-bold underline underline-offset-4">Intentar de nuevo</button>
            </div>
          ) : mostradorDevices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-7 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name="qrcode" size={20} /></span>
              <p className="mt-3 text-sm font-bold text-slate-700">Aún no hay teléfonos conectados</p>
              <p className="mx-auto mt-1 max-w-[34ch] text-xs leading-5 text-slate-500">Genera un código arriba y ábrelo en el teléfono que se usará en mostrador.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 sm:hidden">
                {mostradorDevices.map(device => {
                  const dormant = isDormantDevice(device.lastUsedAt)
                  return (
                    <article key={device.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{device.label || 'Teléfono'}</p>
                          <p className="mt-1 text-xs text-slate-500">Conectado {formatConnectedAt(device.createdAt)}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${dormant ? 'bg-amber-50 text-amber-800' : 'bg-signal-soft text-green-800'}`}>{dormant ? 'Revisar acceso' : 'En uso'}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <p className="text-xs font-semibold text-slate-600"><span className="font-normal text-slate-500">Último uso: </span>{formatLastUsedAt(device.lastUsedAt)}</p>
                        <button type="button" onClick={() => void handleRevokeMostradorDevice(device)} disabled={revokingDeviceId === device.id} className="min-h-11 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition-[background-color,transform] duration-150 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 active:scale-[.97] disabled:opacity-50">{revokingDeviceId === device.id ? 'Revocando…' : 'Revocar'}</button>
                      </div>
                    </article>
                  )
                })}
              </div>
              <div className="hidden sm:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    <tr><th className="px-0 py-2">Teléfono</th><th className="py-2">Conectado</th><th className="py-2">Último uso</th><th className="py-2 text-right"><span className="sr-only">Acciones</span></th></tr>
                  </thead>
                  <tbody>
                    {mostradorDevices.map(device => {
                      const dormant = isDormantDevice(device.lastUsedAt)
                      return (
                        <tr key={device.id} className="border-b border-slate-50 last:border-0">
                          <td className="py-3.5 pr-3 font-semibold text-slate-800">{device.label || 'Teléfono'}</td>
                          <td className="py-3.5 pr-3 text-xs text-slate-500">{formatConnectedAt(device.createdAt)}</td>
                          <td className="py-3.5 pr-3 text-xs font-semibold text-slate-700"><span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${dormant ? 'bg-amber-500' : 'bg-signal'}`} aria-hidden="true" />{formatLastUsedAt(device.lastUsedAt)}</td>
                          <td className="py-3.5 text-right"><button type="button" onClick={() => void handleRevokeMostradorDevice(device)} disabled={revokingDeviceId === device.id} className="min-h-11 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 transition-[background-color,transform] duration-150 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 active:scale-[.97] disabled:opacity-50">{revokingDeviceId === device.id ? 'Revocando…' : 'Revocar'}</button></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {mostradorModalOpen && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-brand-navy/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) closeMostradorModal() }}>
            <div ref={mostradorDialogRef} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="mostrador-modal-title" tabIndex={-1} onKeyDown={handleMostradorModalKeyDown}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon name="qrcode" size={20} /></span><div><h2 id="mostrador-modal-title" className="text-lg font-extrabold tracking-tight text-slate-900">Conectar un teléfono</h2><p className="mt-1 text-xs leading-5 text-slate-500">El código vence pronto y funciona una sola vez.</p></div></div>
                <button type="button" onClick={closeMostradorModal} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15" aria-label="Cerrar"><Icon name="x" size={20} /></button>
              </div>

              {!mostradorPairing ? (
                <div className="mt-5">
                  <label className="block text-xs font-bold text-gray-700" htmlFor="mostrador-label">Nombre del teléfono</label>
                  <input ref={mostradorLabelInputRef} id="mostrador-label" value={mostradorLabel} onChange={event => setMostradorLabel(event.target.value)} autoFocus maxLength={80} className="mt-1.5 min-h-11 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="iPhone de Ana" />
                  <p className="mt-1.5 text-xs text-gray-500">Usa un nombre que te ayude a reconocerlo después.</p>
                  {mostradorPairingError && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700" role="alert">{mostradorPairingError}</p>}
                  <button type="button" onClick={() => void handleGenerateMostradorCode()} disabled={generatingMostradorCode} className="mt-5 min-h-12 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition-[background-color,transform] duration-150 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[.97] disabled:opacity-50">
                    {generatingMostradorCode ? 'Generando…' : 'Generar código'}
                  </button>
                </div>
              ) : pairingExpired ? (
                <div ref={mostradorPairingResultRef} className="mt-6 text-center" tabIndex={-1}><p className="text-lg font-extrabold text-slate-900">Código expirado</p><p className="mt-2 text-sm leading-6 text-slate-500">Genera otro para conectar este teléfono.</p>{mostradorPairingError && <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left text-xs font-semibold text-red-700" role="alert">{mostradorPairingError}</p>}<button type="button" onClick={() => void handleGenerateMostradorCode()} disabled={generatingMostradorCode} className="mt-5 min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-[background-color,transform] duration-150 hover:bg-primary-dark focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 active:scale-[.97] disabled:opacity-50">{generatingMostradorCode ? 'Generando…' : 'Generar otro'}</button></div>
              ) : (
                <div className="mt-5 text-center">
                  <div ref={mostradorPairingResultRef} className="rounded-2xl bg-brand-navy px-4 py-5 text-white shadow-lg shadow-brand-navy/15" tabIndex={-1}>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-signal">Código de conexión</p>
                    <p className="mt-3 font-mono text-4xl font-extrabold tracking-[.18em] text-signal" aria-label={`Código ${mostradorPairing.code}`}>{formatPairingCode(mostradorPairing.code)}</p>
                    <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-100"><span className="h-2 w-2 rounded-full bg-signal" aria-hidden="true" />Expira en {pairingMinutes}:{pairingSeconds}</p>
                  </div>
                  <p className="mx-auto mt-5 max-w-[28ch] text-sm leading-6 text-slate-600">En el teléfono, abre <strong className="text-slate-900">mostrador.copopos.com</strong> y teclea este código.</p>
                  <div className="mt-5"><PairingQr code={mostradorPairing.code} /></div>
                  <p className="mx-auto mt-3 flex max-w-[31ch] items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-left text-xs font-semibold leading-5 text-amber-800"><Icon name="shield" size={16} className="mt-0.5 shrink-0" />Este código autoriza un teléfono. No lo compartas.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Conectar Copo POS">
        {posLink?.linked ? (
          <div>
            <p className="mb-1 inline-flex items-center gap-1 text-sm font-semibold text-green-600"><Icon name="check" size={16} />Vinculado</p>
            {posLink.since && <p className="mb-3 text-xs text-gray-400">Desde {new Date(posLink.since).toLocaleDateString('es-MX')}</p>}
            <button onClick={handleRevoke} disabled={revoking} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
              {revoking ? 'Desvinculando…' : 'Desvincular'}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-gray-500">Genera un código y captúralo en el dashboard de tu Copo POS, sección "Copo Loyalty".</p>
            {pairingCode && (
              <div className="mb-3 rounded-xl bg-primary/10 px-4 py-4 text-center">
                <p className="text-3xl font-bold tracking-widest text-primary">{pairingCode.code}</p>
                <p className="mt-1 text-xs text-gray-500">Expira {new Date(pairingCode.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            <button onClick={handleGenerateCode} disabled={generating} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {generating ? 'Generando…' : pairingCode ? 'Generar otro código' : 'Generar código'}
            </button>
          </div>
        )}
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-400">¿No tienes Copo POS? Conócelo en copopos.com</p>
      </SectionCard>
    </div>
  )
}
