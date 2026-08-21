import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { useAuthStore } from '@/store/authStore'
import { WalletPassPreview } from '@/components/WalletPassPreview'
import { Icon } from '@/components/Icon'
import { api } from '@/lib/api'
import { getColorContrastRatio } from '@/lib/color'
import {
  applyPassTemplate,
  BRAND_PRESETS,
  DEFAULT_PASS_DESIGN,
  isHexColor,
  normalizePassDesign,
  PASS_TEMPLATES,
  type PassAppearanceZone,
  type PassTemplate,
} from '@/lib/passDesign'
import { buildPointsConfig, buildVisitsConfig, centsToPesosInput } from '@/lib/programConfig'
import type { LoyaltyPointsConfig, LoyaltyVisitsConfig, LoyaltyProgram, LoyaltyBusinessInfo } from '@/types/loyalty'

// Mismas reglas que backend/src/services/image-upload.service.ts — se validan
// aquí primero para que el usuario vea el error de inmediato, no tras subir.
interface ImageRules {
  maxBytes: number
  formats: string[]
  minWidth?: number
  minHeight?: number
  requireAlpha?: boolean
  aspect?: { width: number; height: number; tolerance: number }
}

const LOGO_RULES: ImageRules = { maxBytes: 1024 * 1024, formats: ['image/png'], minWidth: 480, minHeight: 150, requireAlpha: true }
const BANNER_RULES: ImageRules = { maxBytes: 2 * 1024 * 1024, formats: ['image/png', 'image/jpeg'], aspect: { width: 1125, height: 432, tolerance: 0.15 } }
const STAMP_RULES: ImageRules = { maxBytes: 1024 * 1024, formats: ['image/png', 'image/jpeg'], minWidth: 64, minHeight: 64 }

// Firma binaria real de los primeros bytes — no basta con file.type (lo infiere
// el navegador de la extensión) ni con el nombre del archivo: alguien puede
// renombrar cualquier cosa a "logo.png".
async function detectImageFormat(file: File): Promise<'image/png' | 'image/jpeg' | null> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  if (head.length >= 8
    && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47
    && head[4] === 0x0D && head[5] === 0x0A && head[6] === 0x1A && head[7] === 0x0A) {
    return 'image/png'
  }
  if (head.length >= 3 && head[0] === 0xFF && head[1] === 0xD8 && head[2] === 0xFF) {
    return 'image/jpeg'
  }
  return null
}

async function readImageInfo(file: File): Promise<{ width: number; height: number; hasAlpha: boolean }> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { width: bitmap.width, height: bitmap.height, hasAlpha: true }
    ctx.drawImage(bitmap, 0, 0)
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
    let hasAlpha = false
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) { hasAlpha = true; break }
    }
    return { width: bitmap.width, height: bitmap.height, hasAlpha }
  } finally {
    bitmap.close()
  }
}

async function validateImage(file: File, rules: ImageRules): Promise<string | null> {
  const allowedLabel = rules.formats.map(f => f.replace('image/', '').toUpperCase()).join(' o ')
  const detectedFormat = await detectImageFormat(file)
  if (!detectedFormat) {
    return `El archivo no es un ${allowedLabel} válido — su contenido no coincide con ninguno de esos formatos, aunque el nombre lo diga`
  }
  if (!rules.formats.includes(detectedFormat)) {
    return `El archivo es en realidad ${detectedFormat === 'image/png' ? 'PNG' : 'JPG'}, pero aquí se necesita ${allowedLabel}`
  }
  if (file.size > rules.maxBytes) {
    return `El archivo pesa más de ${(rules.maxBytes / 1024 / 1024).toFixed(0)} MB`
  }
  let info: { width: number; height: number; hasAlpha: boolean }
  try {
    info = await readImageInfo(file)
  } catch {
    return 'No se pudo leer la imagen — intenta con otro archivo'
  }
  if (rules.minWidth && info.width < rules.minWidth) return `Debe medir al menos ${rules.minWidth}px de ancho (subiste ${info.width}px)`
  if (rules.minHeight && info.height < rules.minHeight) return `Debe medir al menos ${rules.minHeight}px de alto (subiste ${info.height}px)`
  if (rules.requireAlpha && !info.hasAlpha) return 'Debe tener transparencia (canal alfa) — el fondo no puede ser sólido'
  if (rules.aspect) {
    const targetRatio = rules.aspect.width / rules.aspect.height
    const actualRatio = info.height > 0 ? info.width / info.height : 0
    if (Math.abs(actualRatio - targetRatio) / targetRatio > rules.aspect.tolerance) {
      return `La proporción debe ser cercana a ${rules.aspect.width}×${rules.aspect.height} (subiste ${info.width}×${info.height})`
    }
  }
  return null
}

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
  design: LoyaltyBusinessInfo['design']
  minPointsToRedeem: string
  centPerPoint: string
  earnRatePesos: string
  minPurchasePesos: string
  maxPointsPerPurchase: string
  expirationDays: string
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
  design: DEFAULT_PASS_DESIGN,
  minPointsToRedeem: '10',
  centPerPoint: '100',
  earnRatePesos: '1',
  minPurchasePesos: '0',
  maxPointsPerPurchase: '',
  expirationDays: '',
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
  label, hint, required, accept = 'image/png,image/jpeg', previewUrl, uploading, error, onPick,
}: {
  label: string
  hint: string
  required?: boolean
  accept?: string
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
          <p className="text-xs text-gray-400">{hint}</p>
        </div>
        <input
          type="file"
          accept={accept}
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
          <Icon name="shield" size={22} className="text-amber-700" />
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
  const [selectedAppearanceZone, setSelectedAppearanceZone] = useState<PassAppearanceZone>('background')

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

    const validationError = await validateImage(file, kind === 'logo' ? LOGO_RULES : BANNER_RULES)
    if (validationError) {
      setFieldError(validationError)
      return
    }

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
    } catch (err) {
      setFieldError(err instanceof Error ? err.message : `No se pudo subir el ${kind === 'logo' ? 'logo' : 'banner'}`)
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

    const validationError = await validateImage(file, STAMP_RULES)
    if (validationError) {
      setStampError(validationError)
      return
    }

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
    } catch (err) {
      setStampError(err instanceof Error ? err.message : 'No se pudo subir la imagen del sello')
    } finally {
      setUploadingStamp(false)
    }
  }

  function changeProgramType(t: 'points' | 'visits', pointsRiskAcceptedAt?: string) {
    setForm(f => ({
      ...f,
      type: t,
      pointsRiskAcceptedAt: pointsRiskAcceptedAt ?? f.pointsRiskAcceptedAt,
      // Stamp grids are meaningful only for visit programs. Keep a valid
      // visual template when an editor changes the program type.
      design: t === 'points' && normalizePassDesign(f.design).template === 'stamps'
        ? applyPassTemplate(f.design, 'classic')
        : f.design,
    }))
  }

  function handleTypeSelect(t: 'points' | 'visits') {
    if (t === 'points' && !posLinked && !form.pointsRiskAcceptedAt) {
      setRiskModalOpen(true)
      return
    }
    changeProgramType(t)
  }

  function updatePassDesign(change: Partial<typeof DEFAULT_PASS_DESIGN>) {
    setForm(current => ({
      ...current,
      design: { ...normalizePassDesign(current.design), ...change },
    }))
  }

  function handleTemplateSelect(template: PassTemplate) {
    setForm(current => ({
      ...current,
      design: applyPassTemplate(current.design, template),
      // A template changes only visual presentation. It never touches the
      // target, customer balances, rewards, or the protected QR payload.
      visitsVisualStyle: current.type === 'visits'
        ? (template === 'stamps' ? 'stamp' : 'number')
        : current.visitsVisualStyle,
    }))
    setSelectedAppearanceZone(template === 'stamps' && form.type === 'visits' ? 'stamps' : 'background')
  }

  function handleVisitsVisualStyle(visualStyle: 'number' | 'stamp') {
    setForm(current => ({
      ...current,
      visitsVisualStyle: visualStyle,
      design: applyPassTemplate(current.design, visualStyle === 'stamp' ? 'stamps' : 'classic'),
    }))
    setSelectedAppearanceZone(visualStyle === 'stamp' ? 'stamps' : 'progress')
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
      design: normalizePassDesign(program.businessInfo?.design),
      minPointsToRedeem: pc?.minPointsToRedeem?.toString() ?? DEFAULTS.minPointsToRedeem,
      centPerPoint: pc?.centPerPoint?.toString() ?? DEFAULTS.centPerPoint,
      earnRatePesos: centsToPesosInput(pc?.pointsPerCent, DEFAULTS.earnRatePesos),
      minPurchasePesos: centsToPesosInput(pc?.minPurchaseCents, DEFAULTS.minPurchasePesos),
      maxPointsPerPurchase: pc?.maxPointsPerPurchase?.toString() ?? '',
      expirationDays: pc?.expirationDays?.toString() ?? '',
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
      ? buildPointsConfig({
          earnRatePesos: form.earnRatePesos,
          minPurchasePesos: form.minPurchasePesos,
          maxPointsPerPurchase: form.maxPointsPerPurchase,
          expirationDays: form.expirationDays,
          centPerPoint: form.centPerPoint,
          minPointsToRedeem: form.minPointsToRedeem,
          allowPartialRedemption: form.allowPartialRedemption,
          maxVisitsPerDay: form.maxVisitsPerDay,
          noPosRiskAcknowledgedAt: posLinked ? null : form.pointsRiskAcceptedAt,
        })
      : buildVisitsConfig({
          visitsTarget: form.visitsTarget,
          rewardDescription: form.rewardDescription,
          maxVisitsPerDay: form.maxVisitsPerDay,
          visualStyle: form.visitsVisualStyle,
        })
  }

  function normalizeWebsite(value: string): string | undefined {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  }

  function buildBusinessInfo(): LoyaltyBusinessInfo {
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
      design: normalizePassDesign(form.design),
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
        const uploadWarnings: string[] = []
        if (logoPending) {
          const body = new FormData(); body.append('file', logoPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/logo`, body)
            .catch((err: any) => uploadWarnings.push(`Logo: ${err?.message ?? 'no se pudo subir'}`))
        }
        if (bannerPending) {
          const body = new FormData(); body.append('file', bannerPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/banner`, body)
            .catch((err: any) => uploadWarnings.push(`Banner: ${err?.message ?? 'no se pudo subir'}`))
        }
        if (stampPending) {
          const body = new FormData(); body.append('file', stampPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/config/visits/stamp`, body)
            .catch((err: any) => uploadWarnings.push(`Sello: ${err?.message ?? 'no se pudo subir'}`))
        }
        if (uploadWarnings.length) {
          alert(`El programa se creó, pero hubo un problema al subir:\n\n${uploadWarnings.join('\n')}\n\nPuedes volver a subir la imagen desde Editar.`)
        }
        navigate(`/programas/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el programa')
    } finally {
      setSaving(false)
    }
  }

  const passDesign = normalizePassDesign(form.design)
  const brandColorInput = isHexColor(form.brandColor) ? form.brandColor : DEFAULTS.brandColor
  const hasLowStampContrast = form.type === 'visits' && (
    getColorContrastRatio(passDesign.stampFilledColor, brandColorInput) < 3
    || getColorContrastRatio(passDesign.stampEmptyColor, brandColorInput) < 3
  )

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {riskModalOpen && (
        <PointsRiskModal
          onClose={() => setRiskModalOpen(false)}
          onUseVisits={() => { setForm(f => ({ ...f, type: 'visits' })); setRiskModalOpen(false) }}
          onAcceptRisk={() => {
            changeProgramType('points', new Date().toISOString())
            setRiskModalOpen(false)
          }}
        />
      )}
      <Link
        to={isEditing ? `/programas/${programId}` : '/programas'}
        className="inline-flex items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-primary transition hover:text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        <Icon name="arrow-left" size={16} /> Volver a programas
      </Link>
      <div className="mb-7 mt-4 flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Loyalty Studio</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{isEditing ? 'Diseña tu programa' : 'Crea un programa memorable'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Configura la experiencia que verá tu cliente, sus reglas y la información de confianza en un solo lugar.</p>
        </div>
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-teal-500" /> Vista previa en vivo
        </div>
      </div>

      <div className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1fr)_400px]">
        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {!isEditing && (
            <section>
              <div className="mb-3">
                <p className="text-sm font-bold text-slate-950">1. Mecánica del programa</p>
                <p className="mt-1 text-xs text-slate-500">Elige cómo tus clientes desbloquean su beneficio.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['points', 'visits'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => handleTypeSelect(t)}
                    aria-pressed={form.type === t}
                    className={`rounded-2xl border-2 px-4 py-4 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.type === t ? 'border-primary bg-primary/5 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                    <span className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${form.type === t ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Icon name={t === 'points' ? 'sparkles' : 'program'} size={18} />
                    </span>
                    <p className="font-bold text-slate-950">{t === 'points' ? 'Puntos' : 'Visitas'}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{t === 'points' ? 'Ganan puntos por compra' : 'Cuentan visitas hasta un objetivo'}</p>
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
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-primary"><Icon name="image" size={18} /></span>
              <div><p className="text-sm font-bold text-slate-950">2. Identidad visible</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Tu logo y banner se muestran en la tarjeta y en la experiencia de registro.</p></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ImagePickerField
                label="Logo"
                required
                accept="image/png"
                hint="PNG con transparencia, mín. 480×150px, máx. 1 MB"
                previewUrl={logoPending?.previewUrl ?? (form.logoUrl || null)}
                uploading={uploadingLogo}
                error={logoError}
                onPick={f => handlePickImage('logo', f)}
              />
              <ImagePickerField
                label="Banner opcional"
                accept="image/png,image/jpeg"
                hint="PNG o JPG, proporción cercana a 1125×432px, máx. 2 MB"
                previewUrl={bannerPending?.previewUrl ?? (form.bannerUrl || null)}
                uploading={uploadingBanner}
                error={bannerError}
                onPick={f => handlePickImage('banner', f)}
              />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Icon name="sparkles" size={18} /></span>
              <div><p className="text-sm font-bold text-slate-950">3. Diseño de la tarjeta</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Elige una composición y toca la tarjeta para editar cada zona segura.</p></div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-3 sm:p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Loyalty Studio</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">Selecciona una plantilla. Tus colores, sellos y premio se conservan al cambiar.</p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-violet-700 shadow-sm">Edición visual</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PASS_TEMPLATES.map(template => {
                    const selected = passDesign.template === template.id
                    const unavailableForProgram = form.type === 'points' && template.id === 'stamps'
                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={selected}
                        disabled={unavailableForProgram}
                        onClick={() => handleTemplateSelect(template.id)}
                        className={`min-h-11 rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${selected ? 'border-violet-600 bg-white shadow-sm' : 'border-violet-100 bg-white/55 hover:border-violet-300'} disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        <span className="block text-sm font-bold text-slate-900">{template.name}</span>
                        <span className="mt-1 block text-xs leading-4 text-slate-600">{template.description}</span>
                        {unavailableForProgram && <span className="mt-1 block text-[11px] font-semibold text-slate-500">Solo para visitas</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-live="polite">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">Editando: {({ background: 'Fondo', identity: 'Logo y encabezado', progress: 'Contador', stamps: 'Sellos', reward: 'Premio' } as const)[selectedAppearanceZone]}</p>
                    <p className="mt-0.5 text-xs text-slate-500">También puedes tocar esa zona en la vista previa.</p>
                  </div>
                  <button type="button" onClick={() => setSelectedAppearanceZone('background')} className="min-h-11 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30">Ver fondo</button>
                </div>

                {selectedAppearanceZone === 'background' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="rounded-xl border border-slate-200 p-3">
                      <span className="mb-2 block text-xs font-bold text-slate-600">Color principal</span>
                      <span className="flex items-center gap-2"><input type="color" aria-label="Color principal de la tarjeta" value={brandColorInput} onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /><span className="font-mono text-xs uppercase text-slate-700">{brandColorInput}</span></span>
                    </label>
                    <label className="rounded-xl border border-slate-200 p-3">
                      <span className="mb-2 block text-xs font-bold text-slate-600">Color de acento</span>
                      <span className="flex items-center gap-2"><input type="color" aria-label="Color de acento de la tarjeta" value={passDesign.accentColor} onChange={e => updatePassDesign({ accentColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /><span className="font-mono text-xs uppercase text-slate-700">{passDesign.accentColor}</span></span>
                    </label>
                  </div>
                )}

                {selectedAppearanceZone === 'identity' && (
                  <div>
                    <p className="mb-2 text-xs leading-5 text-slate-500">El archivo se cambia en Identidad visible. Aquí decides cómo aparece dentro de la tarjeta.</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['plate', 'minimal'] as const).map(option => <button key={option} type="button" aria-pressed={passDesign.logoStyle === option} onClick={() => updatePassDesign({ logoStyle: option })} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${passDesign.logoStyle === option ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{option === 'plate' ? 'Logo en placa' : 'Logo minimalista'}</button>)}
                    </div>
                  </div>
                )}

                {selectedAppearanceZone === 'progress' && (
                  <div className="space-y-3">
                    <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Etiqueta visible</span><input maxLength={12} value={form.saldoLabel} onChange={e => setForm(f => ({ ...f, saldoLabel: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder={form.type === 'points' ? 'Puntos' : 'Visitas'} /></label>
                    {form.type === 'visits' && <div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={form.visitsVisualStyle === 'number'} onClick={() => handleVisitsVisualStyle('number')} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${form.visitsVisualStyle === 'number' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>Número</button><button type="button" aria-pressed={form.visitsVisualStyle === 'stamp'} onClick={() => handleVisitsVisualStyle('stamp')} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${form.visitsVisualStyle === 'stamp' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>Sellos</button></div>}
                    <p className="text-xs leading-5 text-slate-500">La cifra, la meta y el progreso real vienen de Loyalty y no se pueden editar aquí.</p>
                  </div>
                )}

                {selectedAppearanceZone === 'stamps' && (
                  form.type === 'visits' ? <div className="space-y-3">
                    <ImagePickerField label="Imagen del sello" accept="image/png,image/jpeg" hint="PNG o JPG, mín. 64×64px, máx. 1 MB" previewUrl={stampPending?.previewUrl ?? (form.stampImageUrl || null)} uploading={uploadingStamp} error={stampError} onPick={handlePickStamp} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div><p className="mb-1.5 text-xs font-bold text-slate-600">Forma</p><div className="grid grid-cols-2 gap-2">{(['circle', 'rounded'] as const).map(option => <button key={option} type="button" aria-pressed={passDesign.stampShape === option} onClick={() => updatePassDesign({ stampShape: option })} className={`min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold ${passDesign.stampShape === option ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{option === 'circle' ? 'Circular' : 'Redondeado'}</button>)}</div></div>
                      <div className="grid grid-cols-2 gap-2"><label className="rounded-xl border border-slate-200 p-2"><span className="mb-1 block text-[11px] font-bold text-slate-600">Lleno</span><input type="color" aria-label="Color de sello lleno" value={passDesign.stampFilledColor} onChange={e => updatePassDesign({ stampFilledColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 bg-transparent p-0" /></label><label className="rounded-xl border border-slate-200 p-2"><span className="mb-1 block text-[11px] font-bold text-slate-600">Vacío</span><input type="color" aria-label="Color de sello vacío" value={passDesign.stampEmptyColor} onChange={e => updatePassDesign({ stampEmptyColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 bg-transparent p-0" /></label></div>
                    </div>
                    {hasLowStampContrast && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Los sellos podrían perderse sobre este fondo. Usa un color con mayor contraste.</p>}
                  </div> : <p className="text-sm leading-6 text-slate-600">Los sellos están disponibles en programas de visitas. La tarjeta de puntos conserva su contador real.</p>
                )}

                {selectedAppearanceZone === 'reward' && (
                  <div className="space-y-3"><label className="block rounded-xl border border-slate-200 p-3"><span className="mb-2 block text-xs font-bold text-slate-600">Color del bloque de premio</span><span className="flex items-center gap-2"><input type="color" aria-label="Color del bloque de premio" value={passDesign.rewardColor} onChange={e => updatePassDesign({ rewardColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /><span className="font-mono text-xs uppercase text-slate-700">{passDesign.rewardColor}</span></span></label><p className="text-xs leading-5 text-slate-500">El contenido del premio se define en Reglas y recompensa; su disponibilidad se mantiene protegida.</p></div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del programa</label>
                  <input required maxLength={30} value={form.programName} onChange={e => setForm(f => ({ ...f, programName: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Ej: Copo Rewards" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Etiqueta del saldo</label>
                  <input maxLength={12} value={form.saldoLabel} onChange={e => setForm(f => ({ ...f, saldoLabel: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    placeholder={form.type === 'points' ? 'Puntos' : 'Visitas'} />
                  <p className="mt-1 text-xs text-slate-400">Máx. 12 caracteres; si queda vacío usamos el nombre predeterminado.</p>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Descripción corta</label>
                <input required maxLength={60} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Ej: Gana puntos en cada compra" />
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between gap-3"><label className="text-sm font-semibold text-slate-700">Paleta lista para usar</label><span className="text-xs text-slate-400">Puedes personalizarla después</span></div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {BRAND_PRESETS.map(preset => {
                    const isSelected = form.brandColor === preset.brandColor && passDesign.accentColor === preset.accentColor
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setForm(f => ({ ...f, brandColor: preset.brandColor, design: { ...passDesign, accentColor: preset.accentColor, cardStyle: preset.cardStyle } }))}
                        className={`rounded-xl border p-2.5 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}
                      >
                        <span className="mb-2 flex h-7 overflow-hidden rounded-lg"><span className="w-1/2" style={{ backgroundColor: preset.brandColor }} /><span className="w-1/2" style={{ backgroundColor: preset.accentColor }} /></span>
                        <span className="block text-xs font-bold text-slate-800">{preset.name}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">{preset.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="mb-2 block text-xs font-bold text-slate-600">Color principal</span>
                  <span className="flex items-center gap-2">
                    <input type="color" aria-label="Color principal" value={brandColorInput} onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <input value={form.brandColor} maxLength={7} pattern="#[0-9A-Fa-f]{6}" onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))} className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-slate-700 outline-none" aria-label="Código hexadecimal del color principal" />
                  </span>
                </label>
                <label className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="mb-2 block text-xs font-bold text-slate-600">Color de acento</span>
                  <span className="flex items-center gap-2">
                    <input type="color" aria-label="Color de acento" value={passDesign.accentColor} onChange={e => setForm(f => ({ ...f, design: { ...passDesign, accentColor: e.target.value } }))} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                    <span className="font-mono text-xs uppercase text-slate-700">{passDesign.accentColor}</span>
                  </span>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ['solid', 'Color pleno', 'Un frente claro y directo', 'layout'],
                  ['gradient', 'Degradado', 'Más profundidad de marca', 'sparkles'],
                  ['banner', 'Con banner', 'La imagen toma protagonismo', 'image'],
                ] as const).map(([style, title, description, icon]) => (
                  <button key={style} type="button" aria-pressed={passDesign.cardStyle === style} onClick={() => setForm(f => ({ ...f, design: { ...passDesign, cardStyle: style } }))}
                    className={`rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${passDesign.cardStyle === style ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}>
                    <Icon name={icon} size={17} className="mb-3 text-primary" /><span className="block text-xs font-bold text-slate-800">{title}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-bold text-slate-600">Tratamiento del logo</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['plate', 'minimal'] as const).map(option => <button key={option} type="button" aria-pressed={passDesign.logoStyle === option} onClick={() => setForm(f => ({ ...f, design: { ...passDesign, logoStyle: option } }))} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${passDesign.logoStyle === option ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{option === 'plate' ? 'En placa' : 'Minimalista'}</button>)}
                  </div>
                </div>
                {form.type === 'visits' && form.visitsVisualStyle === 'stamp' && <div>
                  <p className="mb-1.5 text-xs font-bold text-slate-600">Forma de los sellos</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(['circle', 'rounded'] as const).map(option => <button key={option} type="button" aria-pressed={passDesign.stampShape === option} onClick={() => setForm(f => ({ ...f, design: { ...passDesign, stampShape: option } }))} className={`rounded-lg border px-2 py-2 text-xs font-semibold transition ${passDesign.stampShape === option ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{option === 'circle' ? 'Circular' : 'Redondeado'}</button>)}
                  </div>
                </div>}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Icon name="gift" size={18} /></span>
              <div><p className="text-sm font-bold text-slate-950">4. Reglas y recompensa</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Define una meta clara para el cliente y límites seguros para tu operación.</p></div>
            </div>
            {form.type === 'points' ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Compra para ganar 1 punto</span><span className="relative block"><span className="pointer-events-none absolute left-3 top-2.5 text-sm text-slate-400">$</span><input type="number" min="0.01" step="0.01" value={form.earnRatePesos} onChange={e => setForm(f => ({ ...f, earnRatePesos: e.target.value }))} className="w-full rounded-xl border border-slate-200 py-2.5 pl-7 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></span></label>
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Compra mínima para acumular</span><span className="relative block"><span className="pointer-events-none absolute left-3 top-2.5 text-sm text-slate-400">$</span><input type="number" min="0" step="0.01" value={form.minPurchasePesos} onChange={e => setForm(f => ({ ...f, minPurchasePesos: e.target.value }))} className="w-full rounded-xl border border-slate-200 py-2.5 pl-7 pr-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></span></label>
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Puntos mínimos para canjear</span><input type="number" min="1" value={form.minPointsToRedeem} onChange={e => setForm(f => ({ ...f, minPointsToRedeem: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Máx. puntos por compra <span className="font-normal text-slate-400">(opcional)</span></span><input type="number" min="1" value={form.maxPointsPerPurchase} onChange={e => setForm(f => ({ ...f, maxPointsPerPurchase: e.target.value }))} placeholder="Sin límite" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Vencimiento de puntos <span className="font-normal text-slate-400">(días)</span></span><input type="number" min="1" value={form.expirationDays} onChange={e => setForm(f => ({ ...f, expirationDays: e.target.value }))} placeholder="No vencen" className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                </div>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"><input type="checkbox" checked={form.allowPartialRedemption} onChange={e => setForm(f => ({ ...f, allowPartialRedemption: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" /><span><span className="block font-semibold">Permitir canje parcial</span><span className="text-xs text-slate-500">El cliente puede usar una parte de sus puntos cuando aún no completa un premio.</span></span></label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Visitas para ganar el premio</span><input type="number" min="1" value={form.visitsTarget} onChange={e => setForm(f => ({ ...f, visitsTarget: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Premio</span><input required value={form.rewardDescription} onChange={e => setForm(f => ({ ...f, rewardDescription: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Ej: Café americano gratis" /></label>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Formato de progreso</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" aria-pressed={form.visitsVisualStyle === 'number'} onClick={() => handleVisitsVisualStyle('number')} className={`rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.visitsVisualStyle === 'number' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}><Icon name="chart" size={17} className="mb-2 text-primary" /><p className="text-sm font-bold text-slate-800">Número</p><p className="mt-1 text-xs text-slate-500">Ej: 3/10</p></button>
                    <button type="button" aria-pressed={form.visitsVisualStyle === 'stamp'} onClick={() => handleVisitsVisualStyle('stamp')} className={`rounded-xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${form.visitsVisualStyle === 'stamp' ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}><Icon name="check" size={17} className="mb-2 text-primary" /><p className="text-sm font-bold text-slate-800">Sellos</p><p className="mt-1 text-xs text-slate-500">Tarjeta visual personalizable</p></button>
                  </div>
                </div>
                {form.visitsVisualStyle === 'stamp' && <ImagePickerField label="Imagen del sello" hint="PNG cuadrado o circular, fondo transparente, máx. 1 MB" previewUrl={stampPending?.previewUrl ?? (form.stampImageUrl || null)} uploading={uploadingStamp} error={stampError} onPick={handlePickStamp} />}
              </div>
            )}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Máximo de acumulaciones por día</label>
              {antifraudLocked && <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Fijo en 1 por seguridad, sin POS vinculado. Vincula tu POS en Ajustes para desbloquear límites más altos.</p>}
              <select value={form.maxVisitsPerDay} onChange={e => setForm(f => ({ ...f, maxVisitsPerDay: e.target.value }))} disabled={antifraudLocked} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70">
                {['1', '2', '3', '5'].map(n => <option key={n} value={n}>{n} por cliente</option>)}
              </select>
            </div>
          </section>

          <details className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <summary className="flex cursor-pointer list-none items-center gap-3 text-sm font-bold text-slate-950 [&::-webkit-details-marker]:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-primary shadow-sm"><Icon name="clipboard" size={16} /></span>
              Información y términos del negocio
              <Icon name="chevron-down" size={16} className="ml-auto text-slate-400" />
            </summary>
            <p className="mb-3 mt-3 text-xs leading-5 text-slate-500">Opcional. Ayuda a que el cliente encuentre tus términos, contacto y redes desde su tarjeta.</p>
            <div className="space-y-2.5">
              <input value={form.businessTerms} onChange={e => setForm(f => ({ ...f, businessTerms: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Términos y condiciones" />
              <input value={form.businessPhone} onChange={e => setForm(f => ({ ...f, businessPhone: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Teléfono" />
              <input value={form.businessAddress} onChange={e => setForm(f => ({ ...f, businessAddress: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Dirección" />
              <input value={form.businessWebsite} onChange={e => setForm(f => ({ ...f, businessWebsite: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Sitio web" />
              <div className="grid grid-cols-2 gap-2.5">
                <input value={form.businessInstagram} onChange={e => setForm(f => ({ ...f, businessInstagram: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="@instagram" />
                <input value={form.businessFacebook} onChange={e => setForm(f => ({ ...f, businessFacebook: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="/facebook" />
              </div>
            </div>
          </details>

          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={saving || !(form.logoUrl || logoPending)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={saving ? 'pause' : 'check'} size={17} /> {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear programa'}
          </button>
        </form>

        <aside className="h-fit xl:sticky xl:top-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><p className="text-sm font-bold text-slate-950">Vista de cliente</p><p className="mt-0.5 text-xs text-slate-500">Toca una zona para editarla</p></div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">En vivo</span>
            </div>
            <div className="bg-[radial-gradient(circle_at_top,_#e0edff,_#f8fafc_55%)] p-5">
              <WalletPassPreview
                program={{
                  type: form.type,
                  brandColor: brandColorInput,
                  programName: form.programName || 'Mi programa',
                  description: form.description || 'Acumula y gana beneficios',
                  logoUrl: logoPending?.previewUrl ?? form.logoUrl,
                  bannerUrl: bannerPending?.previewUrl ?? (form.bannerUrl || null),
                  saldoLabel: form.saldoLabel || null,
                  businessInfo: { design: passDesign },
                }}
                config={form.type === 'visits'
                  ? { visitsTarget: Number.parseInt(form.visitsTarget, 10) || 10, rewardDescription: form.rewardDescription, visualStyle: form.visitsVisualStyle, stampImageUrl: stampPending?.previewUrl ?? (form.stampImageUrl || null) }
                  : { minPointsToRedeem: Number.parseInt(form.minPointsToRedeem, 10) || 10 }}
                editable
                selectedZone={selectedAppearanceZone}
                onZoneSelect={setSelectedAppearanceZone}
              />
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Configuración del borrador</p>
              <div className="space-y-2 text-sm text-slate-600">
                <p className="flex items-center gap-2"><Icon name="check" size={15} className="text-teal-600" /> Marca, logo y composición de esta vista previa</p>
                <p className="flex items-center gap-2"><Icon name="check" size={15} className="text-teal-600" /> Forma, color e imagen de sellos</p>
                <p className="flex items-center gap-2"><Icon name="shield" size={15} className="text-slate-500" /> QR, saldos y reglas permanecen protegidos</p>
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-xs leading-5 text-slate-500">La interfaz administrativa conserva el estilo Copo. Esta edición visual se guarda de forma segura; la publicación en la tarjeta web y Wallet se conecta en la siguiente fase.</p>
        </aside>
      </div>
    </div>
  )
}
