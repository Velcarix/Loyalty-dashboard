import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link, Navigate } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
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
import { buildVisitsConfig } from '@/lib/programConfig'
import { BANNER_RULES, LOGO_RULES, STAMP_RULES, validateImage } from '@/lib/imageValidation'
import type { LoyaltyVisitsConfig, LoyaltyProgram, LoyaltyBusinessInfo } from '@/types/loyalty'

interface Form {
  programName: string
  description: string
  brandColor: string
  logoUrl: string
  bannerUrl: string
  saldoLabel: string
  design: LoyaltyBusinessInfo['design']
  visitsTarget: string
  rewardDescription: string
  maxVisitsPerDay: string
  visitsVisualStyle: 'number' | 'stamp'
  stampImageUrl: string
  stampEmptyImageUrl: string
}

const DEFAULTS: Form = {
  programName: '',
  description: '',
  brandColor: '#2563EB',
  logoUrl: '',
  bannerUrl: '',
  saldoLabel: '',
  design: DEFAULT_PASS_DESIGN,
  visitsTarget: '10',
  rewardDescription: '',
  maxVisitsPerDay: '1',
  visitsVisualStyle: 'number',
  stampImageUrl: '',
  stampEmptyImageUrl: '',
}

// Único mapa de nombres de zona, compartido por el encabezado "Editando: X"
// y por los tabs de navegación — antes vivían duplicados en cada uso.
const ZONE_LABELS: Record<PassAppearanceZone, string> = {
  background: 'Fondo',
  identity: 'Logo y encabezado',
  progress: 'Contador',
  stamps: 'Sellos',
  reward: 'Premio',
}

interface PendingFile {
  file: File
  previewUrl: string
}

function ImagePickerField({
  label, hint, required, accept = 'image/png,image/jpeg', previewUrl, uploading, error, onPick, onRemove,
}: {
  label: string
  hint: string
  required?: boolean
  accept?: string
  previewUrl: string | null
  uploading: boolean
  error: string | null
  onPick: (file: File) => void
  onRemove?: () => void
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
      {previewUrl && onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={uploading}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:opacity-50"
        >
          <Icon name="trash" size={14} /> Quitar imagen
        </button>
      )}
    </div>
  )
}

export function ProgramEditor() {
  const { programId } = useParams<{ programId: string }>()
  const isEditing = !!programId
  const navigate = useNavigate()
  const { programs, loadPrograms, createProgram, updateProgram } = useProgramsStore()
  const [form, setForm] = useState<Form>(DEFAULTS)
  // Solo aplica al editar el premio base de un programa "visits" existente
  // (un programa nuevo no tiene clientes todavía) — ver checkbox junto a
  // "Visitas para ganar el premio".
  const [applyToExisting, setApplyToExisting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingProgramLimit, setIsCheckingProgramLimit] = useState(() => !isEditing && programs.length === 0)
  const [selectedAppearanceZone, setSelectedAppearanceZone] = useState<PassAppearanceZone>('background')

  // Logo/banner: si el programa ya existe (edición) se sube de inmediato al
  // elegir el archivo; si es nuevo, se guarda localmente y se sube justo
  // después de crear el programa en handleSubmit() — no hay programId antes.
  const [logoPending, setLogoPending] = useState<PendingFile | null>(null)
  const [bannerPending, setBannerPending] = useState<PendingFile | null>(null)
  const [stampPending, setStampPending] = useState<PendingFile | null>(null)
  const [stampEmptyPending, setStampEmptyPending] = useState<PendingFile | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingStamp, setUploadingStamp] = useState(false)
  const [uploadingStampEmpty, setUploadingStampEmpty] = useState(false)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [stampError, setStampError] = useState<string | null>(null)
  const [stampEmptyError, setStampEmptyError] = useState<string | null>(null)

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

  // El logo es obligatorio, así que "Quitar" solo aplica a una imagen recién
  // elegida y aún sin guardar — deshace la selección, no borra el logo activo.
  function handleRemovePendingLogo() {
    setLogoPending(null)
    setLogoError(null)
  }

  // El banner es opcional: se puede quitar del todo. Si hay una selección
  // pendiente, la descarta; si ya estaba guardado (edición), persiste el
  // borrado con PUT bannerUrl:null — mismo patrón directo que la subida, sin
  // pasar por updateProgram para no re-hidratar el formulario a medio editar.
  async function handleRemoveBanner() {
    setBannerError(null)
    if (bannerPending) {
      setBannerPending(null)
      return
    }
    if (!form.bannerUrl) return
    if (!isEditing || !programId) {
      setForm(f => ({ ...f, bannerUrl: '' }))
      return
    }
    setUploadingBanner(true)
    try {
      await api.put(`/api/v1/loyalty/programs/${programId}`, { bannerUrl: null })
      setForm(f => ({ ...f, bannerUrl: '' }))
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'No se pudo quitar el banner')
    } finally {
      setUploadingBanner(false)
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

  // Imagen del sello vacío: mismo patrón que handlePickStamp, pero para la
  // casilla de una visita aún no ganada.
  async function handlePickStampEmpty(file: File) {
    setStampEmptyError(null)

    const validationError = await validateImage(file, STAMP_RULES)
    if (validationError) {
      setStampEmptyError(validationError)
      return
    }

    const previewUrl = URL.createObjectURL(file)

    if (!isEditing || !programId) {
      setStampEmptyPending({ file, previewUrl })
      return
    }

    setUploadingStampEmpty(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const updated = await api.uploadFile<{ stampEmptyImageUrl: string }>(`/api/v1/loyalty/programs/${programId}/config/visits/stamp-empty`, body)
      setForm(f => ({ ...f, stampEmptyImageUrl: updated.stampEmptyImageUrl ?? '' }))
    } catch (err) {
      setStampEmptyError(err instanceof Error ? err.message : 'No se pudo subir la imagen del sello vacío')
    } finally {
      setUploadingStampEmpty(false)
    }
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
      visitsVisualStyle: template === 'stamps' ? 'stamp' : 'number',
    }))
    setSelectedAppearanceZone(template === 'stamps' ? 'stamps' : 'background')
  }

  function handleVisitsVisualStyle(visualStyle: 'number' | 'stamp') {
    setForm(current => ({
      ...current,
      visitsVisualStyle: visualStyle,
      design: applyPassTemplate(current.design, visualStyle === 'stamp' ? 'stamps' : 'classic'),
    }))
    setSelectedAppearanceZone(visualStyle === 'stamp' ? 'stamps' : 'progress')
  }

  const hasExistingPrograms = programs.length > 0

  // El listado ya carga los programas, pero esta comprobación también cubre
  // accesos directos a /programas/nuevo en una pestaña nueva.
  useEffect(() => {
    if (isEditing || hasExistingPrograms) {
      setIsCheckingProgramLimit(false)
      return
    }
    void loadPrograms().finally(() => setIsCheckingProgramLimit(false))
  }, [hasExistingPrograms, isEditing, loadPrograms])

  useEffect(() => {
    if (!isEditing || !programId) return
    const existing = programs.find(p => p.program.id === programId)
    if (!existing) return
    const { program, config } = existing
    const vc = config as LoyaltyVisitsConfig | null
    setForm({
      programName: program.programName,
      description: program.description,
      brandColor: program.brandColor,
      logoUrl: program.logoUrl ?? '',
      bannerUrl: program.bannerUrl ?? '',
      saldoLabel: program.saldoLabel ?? '',
      design: normalizePassDesign(program.businessInfo?.design),
      visitsTarget: vc?.visitsTarget?.toString() ?? DEFAULTS.visitsTarget,
      rewardDescription: vc?.rewardDescription ?? '',
      maxVisitsPerDay: (vc?.maxVisitsPerDay ?? 1).toString(),
      visitsVisualStyle: vc?.visualStyle ?? 'number',
      stampImageUrl: vc?.stampImageUrl ?? '',
      stampEmptyImageUrl: vc?.stampEmptyImageUrl ?? '',
    })
  }, [programId, programs])

  const existingProgram = !isEditing ? programs[0]?.program : undefined
  if (existingProgram) {
    return <Navigate to={`/programas/${existingProgram.id}`} replace />
  }

  function buildConfig() {
    return buildVisitsConfig({
      visitsTarget: form.visitsTarget,
      rewardDescription: form.rewardDescription,
      maxVisitsPerDay: form.maxVisitsPerDay,
      visualStyle: form.visitsVisualStyle,
    })
  }

  function buildBusinessInfo(): LoyaltyBusinessInfo {
    return {
      design: normalizePassDesign(form.design),
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isEditing && isCheckingProgramLimit) {
      setError('Estamos verificando si ya tienes un programa. Intenta de nuevo en un momento.')
      return
    }
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
        const config = buildConfig()
        await updateProgram(programId, programData, { ...config, applyToExistingCustomers: applyToExisting })
        navigate(`/programas/${programId}`)
      } else {
        const created = await createProgram({
          name: form.programName,
          type: 'visits',
          ...programData,
          config: buildVisitsConfig({
            visitsTarget: form.visitsTarget,
            rewardDescription: form.rewardDescription,
            maxVisitsPerDay: form.maxVisitsPerDay,
            visualStyle: form.visitsVisualStyle,
          }),
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
        if (stampEmptyPending) {
          const body = new FormData(); body.append('file', stampEmptyPending.file)
          await api.uploadFile(`/api/v1/loyalty/programs/${created.id}/config/visits/stamp-empty`, body)
            .catch((err: any) => uploadWarnings.push(`Sello vacío: ${err?.message ?? 'no se pudo subir'}`))
        }
        if (uploadWarnings.length) {
          alert(`El programa se creó, pero hubo un problema al subir:\n\n${uploadWarnings.join('\n')}\n\nPuedes volver a subir la imagen desde Editar.`)
        }
        navigate(`/programas/${created.id}`)
      }
    } catch (err) {
      const apiError = err as Error & { code?: string; status?: number }
      if (!isEditing && apiError.status === 409 && apiError.code === 'PROGRAM_ALREADY_EXISTS') {
        await loadPrograms()
        const existingProgram = useProgramsStore.getState().programs[0]?.program
        if (existingProgram) {
          navigate(`/programas/${existingProgram.id}`, { replace: true })
          return
        }
      }
      setError(err instanceof Error ? err.message : 'No se pudo guardar el programa')
    } finally {
      setSaving(false)
    }
  }

  const passDesign = normalizePassDesign(form.design)
  const brandColorInput = isHexColor(form.brandColor) ? form.brandColor : DEFAULTS.brandColor
  // Compara contra el fondo que realmente queda detrás de los sellos: el
  // color propio de la zona de sellos si se definió, o el fondo de la
  // tarjeta cuando se usa el panel automático.
  const stampAreaColorInput = passDesign.stampAreaBackgroundColor ?? brandColorInput
  const hasLowStampContrast = passDesign.stampShape !== 'none' && (
    getColorContrastRatio(passDesign.stampFilledColor, stampAreaColorInput) < 3
    || getColorContrastRatio(passDesign.stampEmptyColor, stampAreaColorInput) < 3
  )

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
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
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Icon name="program" size={18} /></span>
                <div>
                  <p className="text-sm font-bold text-slate-950">1. Programa de visitas</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Cuentan visitas hasta un objetivo. Cada negocio administra un solo programa de lealtad.</p>
                </div>
              </div>
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
                onRemove={logoPending ? handleRemovePendingLogo : undefined}
              />
              <ImagePickerField
                label="Banner opcional"
                accept="image/png,image/jpeg"
                hint="PNG o JPG, proporción cercana a 1125×432px, máx. 2 MB"
                previewUrl={bannerPending?.previewUrl ?? (form.bannerUrl || null)}
                uploading={uploadingBanner}
                error={bannerError}
                onPick={f => handlePickImage('banner', f)}
                onRemove={handleRemoveBanner}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Icon name="clipboard" size={18} /></span>
              <div><p className="text-sm font-bold text-slate-950">3. Detalles del programa</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Cómo se llama tu programa y qué ve el cliente antes de unirse.</p></div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del programa</label>
                <input required maxLength={30} value={form.programName} onChange={e => setForm(f => ({ ...f, programName: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Ej: Copo Rewards" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Descripción corta</label>
                <input required maxLength={60} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Ej: Junta 10 visitas y gánate un café" />
              </div>
            </div>
          </section>

          <section id="diseno-tarjeta" className="scroll-mt-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><Icon name="sparkles" size={18} /></span>
              <div><p className="text-sm font-bold text-slate-950">4. Diseño de la tarjeta</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Elige una plantilla y edita cada zona — tócala aquí o directo en la vista previa.</p></div>
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
                    return (
                      <button
                        key={template.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => handleTemplateSelect(template.id)}
                        className={`min-h-11 rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${selected ? 'border-violet-600 bg-white shadow-sm' : 'border-violet-100 bg-white/55 hover:border-violet-300'} disabled:cursor-not-allowed disabled:opacity-45`}
                      >
                        <span className="block text-sm font-bold text-slate-900">{template.name}</span>
                        <span className="mt-1 block text-xs leading-4 text-slate-600">{template.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4" aria-live="polite">
                <div className="mb-3">
                  <p className="text-sm font-bold text-slate-900">Editando: {ZONE_LABELS[selectedAppearanceZone]}</p>
                  <p className="mt-0.5 text-xs text-slate-500">También puedes tocar esa zona en la vista previa.</p>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  {(Object.keys(ZONE_LABELS) as PassAppearanceZone[]).map(zone => (
                    <button
                      key={zone}
                      type="button"
                      aria-pressed={selectedAppearanceZone === zone}
                      onClick={() => setSelectedAppearanceZone(zone)}
                      className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${selectedAppearanceZone === zone ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {ZONE_LABELS[zone]}
                    </button>
                  ))}
                </div>

                {selectedAppearanceZone === 'background' && (
                  <div className="space-y-4">
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
                    <div>
                      <p className="mb-1.5 text-xs font-bold text-slate-600">Estilo de fondo</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {([
                          ['solid', 'Color pleno', 'layout'],
                          ['gradient', 'Degradado', 'sparkles'],
                          ['banner', 'Con banner', 'image'],
                        ] as const).map(([style, title, icon]) => (
                          <button key={style} type="button" aria-pressed={passDesign.cardStyle === style} onClick={() => updatePassDesign({ cardStyle: style })}
                            className={`min-h-11 rounded-lg border px-3 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${passDesign.cardStyle === style ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                            <Icon name={icon} size={15} className="mb-1" /><span className="block text-xs font-semibold">{title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3"><p className="text-xs font-bold text-slate-600">Paleta lista para usar</p><span className="text-[11px] text-slate-400">Puedes personalizarla después</span></div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {BRAND_PRESETS.map(preset => {
                          const isSelected = form.brandColor === preset.brandColor && passDesign.accentColor === preset.accentColor
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => setForm(f => ({ ...f, brandColor: preset.brandColor, design: { ...passDesign, accentColor: preset.accentColor, cardStyle: preset.cardStyle } }))}
                              className={`min-h-11 rounded-lg border p-2 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/30 ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                              <span className="mb-1 flex h-4 overflow-hidden rounded"><span className="w-1/2" style={{ backgroundColor: preset.brandColor }} /><span className="w-1/2" style={{ backgroundColor: preset.accentColor }} /></span>
                              <span className="block text-[11px] font-bold text-slate-800">{preset.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
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
                    <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Etiqueta visible</span><input maxLength={12} value={form.saldoLabel} onChange={e => setForm(f => ({ ...f, saldoLabel: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Visitas" /></label>
                    <div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={form.visitsVisualStyle === 'number'} onClick={() => handleVisitsVisualStyle('number')} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${form.visitsVisualStyle === 'number' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>Número</button><button type="button" aria-pressed={form.visitsVisualStyle === 'stamp'} onClick={() => handleVisitsVisualStyle('stamp')} className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-semibold ${form.visitsVisualStyle === 'stamp' ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>Sellos</button></div>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <input type="checkbox" checked={passDesign.showMemberName} onChange={e => updatePassDesign({ showMemberName: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary" />
                      <span><span className="block font-semibold">Mostrar nombre del cliente</span><span className="text-xs text-slate-500">Aparece en la tarjeta, debajo del progreso y el premio.</span></span>
                    </label>
                    <p className="text-xs leading-5 text-slate-500">La cifra, la meta y el progreso real vienen de Loyalty y no se pueden editar aquí.</p>
                  </div>
                )}

                {selectedAppearanceZone === 'stamps' && (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ImagePickerField label="Imagen del sello lleno" accept="image/png,image/jpeg" hint="PNG o JPG, mín. 64×64px, máx. 1 MB" previewUrl={stampPending?.previewUrl ?? (form.stampImageUrl || null)} uploading={uploadingStamp} error={stampError} onPick={handlePickStamp} />
                      <ImagePickerField label="Imagen del sello vacío" accept="image/png,image/jpeg" hint="Opcional. Ícono para la casilla sin ganar" previewUrl={stampEmptyPending?.previewUrl ?? (form.stampEmptyImageUrl || null)} uploading={uploadingStampEmpty} error={stampEmptyError} onPick={handlePickStampEmpty} />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-bold text-slate-600">Forma</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(['circle', 'rounded', 'square', 'none'] as const).map(option => <button key={option} type="button" aria-pressed={passDesign.stampShape === option} onClick={() => updatePassDesign({ stampShape: option })} className={`min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold ${passDesign.stampShape === option ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 text-slate-600'}`}>{{ circle: 'Circular', rounded: 'Redondeado', square: 'Cuadrado', none: 'Sin contenedor' }[option]}</button>)}
                      </div>
                      {passDesign.stampShape === 'none' && <p className="mt-1.5 text-xs leading-5 text-slate-500">La imagen del sello se muestra tal cual, sin recorte ni fondo — ideal si ya tiene su propia forma y transparencia.</p>}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="rounded-xl border border-slate-200 p-2"><span className="mb-1 block text-[11px] font-bold text-slate-600">Lleno</span><input type="color" aria-label="Color de sello lleno" value={passDesign.stampFilledColor} onChange={e => updatePassDesign({ stampFilledColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 bg-transparent p-0" /></label>
                      <label className="rounded-xl border border-slate-200 p-2"><span className="mb-1 block text-[11px] font-bold text-slate-600">Vacío</span><input type="color" aria-label="Color de sello vacío" value={passDesign.stampEmptyColor} onChange={e => updatePassDesign({ stampEmptyColor: e.target.value })} className="h-8 w-full cursor-pointer rounded border-0 bg-transparent p-0" /></label>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">Fondo de la zona de sellos</span>
                        {passDesign.stampAreaBackgroundColor && <button type="button" onClick={() => updatePassDesign({ stampAreaBackgroundColor: undefined })} className="text-[11px] font-semibold text-primary hover:underline">Usar automático</button>}
                      </div>
                      <span className="flex items-center gap-2">
                        <input type="color" aria-label="Color de fondo de la zona de sellos" value={passDesign.stampAreaBackgroundColor ?? '#12344D'} onChange={e => updatePassDesign({ stampAreaBackgroundColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" />
                        <input
                          value={passDesign.stampAreaBackgroundColor ?? ''}
                          maxLength={7}
                          pattern="#[0-9A-Fa-f]{6}"
                          placeholder="Automático (mismo fondo translúcido de siempre)"
                          onChange={e => updatePassDesign({ stampAreaBackgroundColor: e.target.value || undefined })}
                          className="min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-slate-700 outline-none placeholder:normal-case placeholder:font-sans placeholder:text-slate-400"
                          aria-label="Código hexadecimal del fondo de la zona de sellos"
                        />
                      </span>
                      <p className="mt-1.5 text-xs leading-5 text-slate-500">Deja este campo vacío para conservar el fondo automático actual; escribe un HEX para usar un color propio (ej. un azul más oscuro que el fondo general).</p>
                    </div>
                    {hasLowStampContrast && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">Los sellos podrían perderse sobre este fondo. Usa un color con mayor contraste.</p>}
                    <div className="border-t border-slate-100 pt-3">
                      <span className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600"><span>Cómo le llamas a un sello</span><span className="font-normal text-slate-400">{(passDesign.terminology.stampSingular ?? '').length}/20</span></span>
                      <div className="grid grid-cols-2 gap-2">
                        <input maxLength={20} value={passDesign.terminology.stampSingular ?? ''} onChange={e => updatePassDesign({ terminology: { ...passDesign.terminology, stampSingular: e.target.value } })} placeholder="visita" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                        <input maxLength={20} value={passDesign.terminology.stampPlural ?? ''} onChange={e => updatePassDesign({ terminology: { ...passDesign.terminology, stampPlural: e.target.value } })} placeholder="visitas" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                      </div>
                    </div>
                  </div>
                )}

                {selectedAppearanceZone === 'reward' && (
                  <div className="space-y-3">
                    <label className="block rounded-xl border border-slate-200 p-3"><span className="mb-2 block text-xs font-bold text-slate-600">Color del bloque de premio</span><span className="flex items-center gap-2"><input type="color" aria-label="Color del bloque de premio" value={passDesign.rewardColor} onChange={e => updatePassDesign({ rewardColor: e.target.value })} className="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /><span className="font-mono text-xs uppercase text-slate-700">{passDesign.rewardColor}</span></span></label>
                    <p className="text-xs leading-5 text-slate-500">El contenido del premio se define en Reglas y recompensa; su disponibilidad se mantiene protegida.</p>
                    <div className="border-t border-slate-100 pt-3">
                      <span className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600"><span>Cómo le llamas a un premio</span><span className="font-normal text-slate-400">{(passDesign.terminology.rewardSingular ?? '').length}/20</span></span>
                      <div className="grid grid-cols-2 gap-2">
                        <input maxLength={20} value={passDesign.terminology.rewardSingular ?? ''} onChange={e => updatePassDesign({ terminology: { ...passDesign.terminology, rewardSingular: e.target.value } })} placeholder="premio" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                        <input maxLength={20} value={passDesign.terminology.rewardPlural ?? ''} onChange={e => updatePassDesign({ terminology: { ...passDesign.terminology, rewardPlural: e.target.value } })} placeholder="premios" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700"><Icon name="gift" size={18} /></span>
              <div><p className="text-sm font-bold text-slate-950">5. Reglas y recompensa</p><p className="mt-0.5 text-xs leading-5 text-slate-500">Define una meta clara para el cliente y límites seguros para tu operación.</p></div>
            </div>
            <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Visitas para ganar el premio</span><input type="number" min="1" value={form.visitsTarget} onChange={e => setForm(f => ({ ...f, visitsTarget: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>
                  <label><span className="mb-1.5 block text-sm font-semibold text-slate-700">Premio</span><input required value={form.rewardDescription} onChange={e => setForm(f => ({ ...f, rewardDescription: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" placeholder="Ej: Café americano gratis" /></label>
                </div>
                {isEditing && programId && (
                  <>
                    <p className="text-xs leading-5 text-slate-500">
                      ¿Quieres más de un nivel de premio (ej. 5 visitas → café, 10 → postre)? Agrega niveles adicionales en{' '}
                      <Link to={`/programas/${programId}/rewards`} className="font-semibold text-primary hover:underline">Recompensas</Link>.
                    </p>
                    <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                      <span className="text-sm font-semibold text-slate-700">Aplicar a usuarios actuales</span>
                      <input type="checkbox" checked={applyToExisting} onChange={e => setApplyToExisting(e.target.checked)} className="h-4 w-4 accent-primary" />
                    </label>
                    <p className="text-xs leading-5 text-slate-500">
                      {applyToExisting
                        ? 'La meta/premio nuevos se actualizan también para los clientes que ya tienen wallet.'
                        : 'Solo aplica a wallets nuevas — los clientes actuales conservan la meta/premio con la que ya venían.'}
                    </p>
                  </>
                )}
                <p className="text-xs leading-5 text-slate-500">
                  El formato del contador (número o sellos) y las imágenes de sello se eligen en{' '}
                  <a href="#diseno-tarjeta" onClick={() => setSelectedAppearanceZone('progress')} className="font-semibold text-primary hover:underline">Diseño de la tarjeta → Contador</a>.
                </p>
              </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Máximo de acumulaciones por día</label>
              <select value={form.maxVisitsPerDay} onChange={e => setForm(f => ({ ...f, maxVisitsPerDay: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70">
                {['1', '2', '3', '5'].map(n => <option key={n} value={n}>{n} por cliente</option>)}
              </select>
            </div>
          </section>

          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={saving || !(form.logoUrl || logoPending)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={saving ? 'pause' : 'check'} size={17} /> {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear programa'}
          </button>
        </form>

        <aside className="h-fit self-start lg:sticky lg:top-6">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><p className="text-sm font-bold text-slate-950">Vista de cliente</p><p className="mt-0.5 text-xs text-slate-500">Toca una zona para editarla</p></div>
              <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">En vivo</span>
            </div>
            <div className="bg-[radial-gradient(circle_at_top,_#e0edff,_#f8fafc_55%)] p-5">
              <WalletPassPreview
                program={{
                  type: 'visits',
                  brandColor: brandColorInput,
                  programName: form.programName || 'Mi programa',
                  description: form.description || 'Junta visitas y gánate premios',
                  logoUrl: logoPending?.previewUrl ?? form.logoUrl,
                  bannerUrl: bannerPending?.previewUrl ?? (form.bannerUrl || null),
                  saldoLabel: form.saldoLabel || null,
                  businessInfo: { design: passDesign },
                }}
                config={{
                  visitsTarget: Number.parseInt(form.visitsTarget, 10) || 10,
                  rewardDescription: form.rewardDescription,
                  visualStyle: form.visitsVisualStyle,
                  stampImageUrl: stampPending?.previewUrl ?? (form.stampImageUrl || null),
                  stampEmptyImageUrl: stampEmptyPending?.previewUrl ?? (form.stampEmptyImageUrl || null),
                }}
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
