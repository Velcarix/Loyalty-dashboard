import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'
import { WalletPassPreview } from '@/components/WalletPassPreview'
import { api } from '@/lib/api'
import type { LoyaltyPointsConfig, LoyaltyVisitsConfig, LoyaltyProgram, LoyaltyBusinessInfo } from '@/types/loyalty'

const PRESET_COLORS = ['#2563EB', '#1D4ED8', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#16A34A', '#0891B2', '#374151']

interface Form {
  type: 'points' | 'visits'
  programName: string
  description: string
  brandColor: string
  logoUrl: string
  bannerUrl: string
  saldoLabel: string
  businessTerms: string
  businessPhone: string
  businessAddress: string
  businessWebsite: string
  businessInstagram: string
  businessFacebook: string
  minPointsToRedeem: string
  centPerPoint: string
  pointsPerCent: string
  allowPartialRedemption: boolean
  visitsTarget: string
  rewardDescription: string
  maxVisitsPerDay: string
  visitsVisualStyle: 'number' | 'stamp'
  stampImageUrl: string
  // Puntos sin POS vinculado — timestamp de cuando el comerciante aceptó el
  // riesgo de fraude (nadie más que el propio empleado valida el monto tecleado).
  pointsRiskAcceptedAt: string | null
}

const DEFAULTS: Form = {
  type: 'points',
  programName: '',
  description: '',
  brandColor: '#2563EB',
  logoUrl: '',
  bannerUrl: '',
  saldoLabel: '',
  businessTerms: '',
  businessPhone: '',
  businessAddress: '',
  businessWebsite: '',
  businessInstagram: '',
  businessFacebook: '',
  minPointsToRedeem: '10',
  centPerPoint: '100',
  pointsPerCent: '0.001',
  allowPartialRedemption: true,
  visitsTarget: '10',
  rewardDescription: '',
  maxVisitsPerDay: '1',
  visitsVisualStyle: 'number',
  stampImageUrl: '',
  pointsRiskAcceptedAt: null,
}

interface PendingFile {
  file: File
  previewUrl: string
}

function ImagePickerField({
  label, hint, required, previewUrl, uploading, error, onPick,
}: {
  label: string
  hint: string
  required?: boolean
  previewUrl: string | null
  uploading: boolean
  error: string | null
  onPick: (file: File) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-gray-700">
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-gray-300 px-3 py-2.5 hover:border-primary">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
          {uploading
            ? <span className="text-xs text-gray-400">…</span>
            : previewUrl
              ? <img src={previewUrl} alt="" className="h-full w-full object-contain" />
              : <span className="text-gray-400">+</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{previewUrl ? 'Cambiar imagen' : 'Subir imagen'}</p>
          <p className="truncate text-xs text-gray-400">{hint}</p>
        </div>
        <input
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }}
        />
      </label>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function PointsRiskModal({
  onUseVisits, onAcceptRisk, onClose,
}: {
  onUseVisits: () => void
  onAcceptRisk: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
          <span className="text-2xl" aria-hidden="true">⚠</span>
        </div>
        <h2 className="mb-1 text-lg font-bold text-gray-900">Puntos sin POS vinculado</h2>
        <p className="mb-4 text-sm text-gray-500">Para tu operación, esto es lo que estarías asumiendo:</p>

        <div className="mb-4 space-y-3 text-sm text-gray-700">
          <p>El monto de cada compra lo teclea a mano el mismo empleado que registra la acumulación. No hay nada que lo valide en el momento.</p>
          <p>No hay forma de prevenir que un empleado infle el monto para dar más puntos — solo se detecta después, en el reporte de anomalías.</p>
        </div>

        <div className="mb-5 rounded-xl bg-gray-100 px-4 py-3">
          <p className="text-xs text-gray-600">
            Si continúas de todos modos, dejamos el límite diario de acumulaciones fijo en 1 por cliente y el reporte de anomalías activo, para acotar el impacto.
          </p>
        </div>

        <button type="button" onClick={onUseVisits} className="mb-2.5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">
          Usar Visitas (recomendado)
        </button>
        <button type="button" onClick={onAcceptRisk} className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600">
          Entiendo el riesgo, continuar con Puntos
        </button>
      </div>
    </div>
  )
}

export function ProgramEditor() {
  const { programId } = useParams<{ programId: string }>()
  const isEditing = !!programId
  const navigate = useNavigate()
  const posLinked = useAuthStore(s => s.posLink?.linked ?? false)
  const { programs, createProgram, updateProgram } = useProgramsStore()
  const [form, setForm] = useState<Form>(() => ({
    ...DEFAULTS,
    type: isEditing || posLinked ? DEFAULTS.type : 'visits',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [riskModalOpen, setRiskModalOpen] = useState(false)

  // Logo/banner: si el programa ya existe (edición) se sube de inmediato al
  // elegir el archivo; si es nuevo, se guarda localmente y se sube justo
  // después de crear el programa en handleSubmit() — no hay programId antes.
  const [logoPending, setLogoPending] = useState<PendingFile | null>(null)
  const [bannerPending, setBannerPending] = useState<PendingFile | null>(null)
  const [stampPending, setStampPending] = useState<PendingFile | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [stampError, setStampError] = useState<string | null>(null)

  async function handlePickImage(kind: 'logo' | 'banner', file: File) {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingBanner
    const setFieldError = kind === 'logo' ? setLogoError : setBannerError
    const setPending = kind === 'logo' ? setLogoPending : setBannerPending
    setFieldError(null)
    const previewUrl = URL.createObjectURL(file)

    if (!isEditing || !programId) {
      setPending({ file, previewUrl })
      return
    }

    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const updated = await api.uploadFile<LoyaltyProgram>(`/api/v1/loyalty/programs/${programId}/${kind}`, body)
      setForm(f => ({ ...f, [kind === 'logo' ? 'logoUrl' : 'bannerUrl']: (kind === 'logo' ? updated.logoUrl : updated.bannerUrl) ?? '' }))
    } catch (err: any) {
      setFieldError(err?.message ?? `No se pudo subir el ${kind === 'logo' ? 'logo' : 'banner'}`)
    } finally {
      setUploading(false)
    }
  }

  // Imagen del sello (tarjeta de sellos): mismo patrón que logo/banner —
  // sube de inmediato si el programa ya existe, o queda pendiente hasta
  // crearlo. Es un asset de la config de visitas, no del programa, por eso
  // usa su propio endpoint en vez de handlePickImage.
  async function handlePickStamp(file: File) {
    setStampError(null)
    const previewUrl = URL.createObjectURL(file)

    if (!isEditing || !programId) {
      setStampPending({ file, previewUrl })
      return
    }

    setUploadingStamp(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const updated = await api.uploadFile<{ stampImageUrl: string }>(`/api/v1/loyalty/programs/${programId}/config/visits/stamp`, body)
      setForm(f => ({ ...f, stampImageUrl: updated.stampImageUrl ?? '' }))
    } catch (err: any) {
      setStampError(err?.message ?? 'No se pudo subir la imagen del sello')
    } finally {
      setUploadingStamp(false)
    }
  }

  function handleTypeSelect(t: 'points' | 'visits') {
    if (t === 'points' && !posLinked && !form.pointsRiskAcceptedAt) {
      setRiskModalOpen(true)
      return
    }
    setForm(f => ({ ...f, type: t }))
  }

  const antifraudLocked = form.type === 'points' && !posLinked
  useEffect(() => {
    if (antifraudLocked && form.maxVisitsPerDay !== '1') {
      setForm(f => ({ ...f, maxVisitsPerDay: '1' }))
    }
  }, [antifraudLocked])

  useEffect(() => {
    if (!isEditing || !programId) return
    const existing = programs.find(p => p.program.id === programId)
    if (!existing) return
    const { program, config } = existing
    const isPoints = program.type === 'points'
    const pc = isPoints ? config as LoyaltyPointsConfig : null
    const vc = !isPoints ? config as LoyaltyVisitsConfig : null
    setForm({
      type: program.type,
      programName: program.programName,
      description: program.description,
      brandColor: program.brandColor,
      logoUrl: program.logoUrl ?? '',
      bannerUrl: program.bannerUrl ?? '',
      saldoLabel: program.saldoLabel ?? '',
      businessTerms: program.businessInfo?.terms ?? '',
      businessPhone: program.businessInfo?.phone ?? '',
      businessAddress: program.businessInfo?.address ?? '',
      businessWebsite: program.businessInfo?.website ?? '',
      businessInstagram: program.businessInfo?.socials?.instagram ?? '',
      businessFacebook: program.businessInfo?.socials?.facebook ?? '',
      minPointsToRedeem: pc?.minPointsToRedeem?.toString() ?? DEFAULTS.minPointsToRedeem,
      centPerPoint: pc?.centPerPoint?.toString() ?? DEFAULTS.centPerPoint,
      pointsPerCent: pc?.pointsPerCent?.toString() ?? DEFAULTS.pointsPerCent,
      allowPartialRedemption: pc?.allowPartialRedemption ?? true,
      visitsTarget: vc?.visitsTarget?.toString() ?? DEFAULTS.visitsTarget,
      rewardDescription: vc?.rewardDescription ?? '',
      maxVisitsPerDay: (pc?.maxVisitsPerDay ?? vc?.maxVisitsPerDay ?? 1).toString(),
      visitsVisualStyle: vc?.visualStyle ?? 'number',
      stampImageUrl: vc?.stampImageUrl ?? '',
      pointsRiskAcceptedAt: pc?.noPosRiskAcknowledgedAt ?? null,
    })
  }, [programId, programs])

  function buildConfig() {
    return form.type === 'points'
      ? {
          pointsPerCent: parseFloat(form.pointsPerCent),
          centPerPoint: parseInt(form.centPerPoint),
          allowPartialRedemption: form.allowPartialRedemption,
          minPointsToRedeem: parseInt(form.minPointsToRedeem),
          maxVisitsPerDay: parseInt(form.maxVisitsPerDay),
          noPosRiskAcknowledgedAt: posLinked ? null : form.pointsRiskAcceptedAt,
        }
      : {
          visitsTarget: parseInt(form.visitsTarget),
          rewardDescription: form.rewardDescription,
          maxVisitsPerDay: parseInt(form.maxVisitsPerDay),
          visualStyle: form.visitsVisualStyle,
        }
  }

  function normalizeWebsite(value: string): string | undefined {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  function buildBusinessInfo(): LoyaltyBusinessInfo | null {
    const hasAny = form.businessTerms || form.businessPhone || form.businessAddress
      || form.businessWebsite || form.businessInstagram || form.businessFacebook
    if (!hasAny) return null
    const hasSocials = !!(form.businessInstagram || form.businessFacebook)
    return {
      terms: form.businessTerms || undefined,
      phone: form.businessPhone || undefined,
      address: form.businessAddress || undefined,
      website: normalizeWebsite(form.businessWebsite),
      socials: hasSocials ? {
        instagram: form.businessInstagram || undefined,
        facebook: form.businessFacebook || undefined,
      } : undefined,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const programData = {
        programName: form.programName,
        description: form.description,
        brandColor: form.brandColor,
        saldoLabel: form.saldoLabel || null,
        businessInfo: buildBusinessInfo(),
      }
      if (isEditing && programId) {
        await updateProgram(programId, programData, buildConfig())
        navigate(`/programas/${programId}`)
      } else {
        const created = await createProgram({
          name: form.programName,
          type: form.type,
          ...programData,
          config: buildConfig(),
        })
        if (logoPending) {
          const body = new FormData(); body.append('file', logoPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/logo`, body).catch(() => {})
        }
        if (bannerPending) {
          const body = new FormData(); body.append('file', bannerPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/banner`, body).catch(() => {})
        }
        if (stampPending) {
          const body = new FormData(); body.append('file', stampPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/config/visits/stamp`, body).catch(() => {})
        }
        navigate(`/programas/${created.id}`)
      }
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar el programa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      {riskModalOpen && (
        <PointsRiskModal
          onClose={() => setRiskModalOpen(false)}
          onUseVisits={() => { setForm(f => ({ ...f, type: 'visits' })); setRiskModalOpen(false) }}
          onAcceptRisk={() => {
            setForm(f => ({ ...f, type: 'points', pointsRiskAcceptedAt: new Date().toISOString() }))
            setRiskModalOpen(false)
          }}
        />
      )}
      <Link to={isEditing ? `/programas/${programId}` : '/programas'} className="text-sm text-primary">← Volver</Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold text-gray-900">{isEditing ? 'Editar programa' : 'Nuevo programa'}</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
          {!isEditing && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Tipo de programa</label>
              <div className="grid grid-cols-2 gap-2">
                {(['points', 'visits'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => handleTypeSelect(t)}
                    className={`rounded-lg border-2 px-3 py-3 text-left text-sm ${form.type === t ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                  >
                    <p className="font-bold">{t === 'points' ? '⭐ Puntos' : '🎯 Visitas'}</p>
                    <p className="text-xs text-gray-500">{t === 'points' ? 'Ganan puntos por compra' : 'Cuentan visitas hasta un objetivo'}</p>
                    {t === 'points' && !posLinked && (
                      <p className={`mt-1 text-xs font-semibold ${form.pointsRiskAcceptedAt ? 'text-green-600' : 'text-amber-600'}`}>
                        {form.pointsRiskAcceptedAt ? 'Riesgo aceptado' : 'Requiere aceptar el riesgo — sin POS vinculado'}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              {!posLinked && (
                <p className="mt-2 text-xs text-gray-500">
                  No tienes Copo POS vinculado. Recomendamos Visitas — con Puntos, el monto de cada venta lo captura a mano el mismo empleado que acumula.
                </p>
              )}
            </div>
          )}

          <ImagePickerField
            label="Logo"
            required
            hint="PNG con transparencia, mín. 480×150px, máx. 1 MB"
            previewUrl={logoPending?.previewUrl ?? (form.logoUrl || null)}
            uploading={uploadingLogo}
            error={logoError}
            onPick={f => handlePickImage('logo', f)}
          />
          <ImagePickerField
            label="Banner (opcional)"
            hint="PNG o JPG, proporción ~1125×432px, máx. 2 MB"
            previewUrl={bannerPending?.previewUrl ?? (form.bannerUrl || null)}
            uploading={uploadingBanner}
            error={bannerError}
            onPick={f => handlePickImage('banner', f)}
          />

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Nombre del programa</label>
            <input required maxLength={30} value={form.programName} onChange={e => setForm(f => ({ ...f, programName: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Ej: Copo Rewards" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Descripción corta</label>
            <input required maxLength={60} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Ej: Gana puntos en cada compra" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Etiqueta del saldo</label>
            <input maxLength={12} value={form.saldoLabel} onChange={e => setForm(f => ({ ...f, saldoLabel: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder={form.type === 'points' ? 'Puntos' : 'Visitas'} />
            <p className="mt-1 text-xs text-gray-400">≤12 caracteres. Si lo dejas vacío, se usa "{form.type === 'points' ? 'Puntos' : 'Visitas'}"</p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">Color principal</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, brandColor: c }))}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-lg ${form.brandColor === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`} />
              ))}
              <label
                title="Elegir cualquier color"
                className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-gray-300"
                style={{
                  backgroundImage: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
                }}
              >
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>
              <input value={form.brandColor} onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs font-mono" />
            </div>
            <p className="mt-1 text-xs text-gray-400">Elige un preset, cualquier color con la rueda, o escribe el hex.</p>
          </div>

          {form.type === 'points' ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Puntos mínimos para canjear</label>
                <input type="number" value={form.minPointsToRedeem} onChange={e => setForm(f => ({ ...f, minPointsToRedeem: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.allowPartialRedemption} onChange={e => setForm(f => ({ ...f, allowPartialRedemption: e.target.checked }))} />
                Permitir canje parcial
              </label>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Visitas para ganar el premio</label>
                <input type="number" value={form.visitsTarget} onChange={e => setForm(f => ({ ...f, visitsTarget: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Premio</label>
                <input required value={form.rewardDescription} onChange={e => setForm(f => ({ ...f, rewardDescription: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Ej: Café americano gratis" />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Formato de progreso</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, visitsVisualStyle: 'number' }))}
                    className={`rounded-lg border-2 px-3 py-3 text-left text-sm ${form.visitsVisualStyle === 'number' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                  >
                    <p className="font-bold">🔢 Número</p>
                    <p className="text-xs text-gray-500">Ej: 3/10</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, visitsVisualStyle: 'stamp' }))}
                    className={`rounded-lg border-2 px-3 py-3 text-left text-sm ${form.visitsVisualStyle === 'stamp' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                  >
                    <p className="font-bold">⭕ Sellos</p>
                    <p className="text-xs text-gray-500">Tarjeta de sellos personalizada</p>
                  </button>
                </div>
              </div>

              {form.visitsVisualStyle === 'stamp' && (
                <ImagePickerField
                  label="Imagen del sello"
                  hint="PNG cuadrado o circular, fondo transparente, máx. 1 MB"
                  previewUrl={stampPending?.previewUrl ?? (form.stampImageUrl || null)}
                  uploading={uploadingStamp}
                  error={stampError}
                  onPick={handlePickStamp}
                />
              )}
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Máximo de acumulaciones por día (antifraude)</label>
            {antifraudLocked && (
              <p className="mb-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Fijo en 1 por seguridad, sin POS vinculado. Vincula tu POS en Ajustes para desbloquear límites más altos.
              </p>
            )}
            <select
              value={form.maxVisitsPerDay}
              onChange={e => setForm(f => ({ ...f, maxVisitsPerDay: e.target.value }))}
              disabled={antifraudLocked}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none disabled:opacity-50"
            >
              {['1', '2', '3', '5'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <label className="mb-2 block text-sm font-semibold text-gray-700">Info del negocio (reverso del pass)</label>
            <div className="space-y-2.5">
              <input value={form.businessTerms} onChange={e => setForm(f => ({ ...f, businessTerms: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Términos y condiciones" />
              <input value={form.businessPhone} onChange={e => setForm(f => ({ ...f, businessPhone: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Teléfono" />
              <input value={form.businessAddress} onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Dirección" />
              <input value={form.businessWebsite} onChange={e => setForm(f => ({ ...f, businessWebsite: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="Sitio web" />
              <div className="grid grid-cols-2 gap-2.5">
                <input value={form.businessInstagram} onChange={e => setForm(f => ({ ...f, businessInstagram: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="@instagram" />
                <input value={form.businessFacebook} onChange={e => setForm(f => ({ ...f, businessFacebook: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" placeholder="/facebook" />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving || !(form.logoUrl || logoPending)}
            className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear programa'}
          </button>
        </form>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Vista previa</p>
          <WalletPassPreview
            program={{
              type: form.type,
              brandColor: form.brandColor,
              programName: form.programName || 'Mi programa',
              description: form.description || 'Acumula y gana beneficios',
              logoUrl: logoPending?.previewUrl ?? form.logoUrl,
              bannerUrl: bannerPending?.previewUrl ?? (form.bannerUrl || null),
              saldoLabel: form.saldoLabel || null,
            }}
            config={form.type === 'visits'
              ? {
                  visitsTarget: parseInt(form.visitsTarget) || 10,
                  rewardDescription: form.rewardDescription,
                  visualStyle: form.visitsVisualStyle,
                  stampImageUrl: stampPending?.previewUrl ?? (form.stampImageUrl || null),
                }
              : { centPerPoint: parseInt(form.centPerPoint) || 100, minPointsToRedeem: parseInt(form.minPointsToRedeem) || 10 }}
          />
        </div>
      </div>
    </div>
  )
}
