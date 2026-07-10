import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { WalletPassPreview } from '@/components/WalletPassPreview'
import type { LoyaltyPointsConfig, LoyaltyVisitsConfig } from '@/types/loyalty'

const PRESET_COLORS = ['#7C3AED', '#2563EB', '#DB2777', '#DC2626', '#D97706', '#16A34A', '#0891B2', '#374151']

interface Form {
  type: 'points' | 'visits'
  programName: string
  description: string
  brandColor: string
  minPointsToRedeem: string
  centPerPoint: string
  pointsPerCent: string
  allowPartialRedemption: boolean
  visitsTarget: string
  rewardDescription: string
  maxVisitsPerDay: string
}

const DEFAULTS: Form = {
  type: 'points',
  programName: '',
  description: '',
  brandColor: '#7C3AED',
  minPointsToRedeem: '10',
  centPerPoint: '100',
  pointsPerCent: '0.001',
  allowPartialRedemption: true,
  visitsTarget: '10',
  rewardDescription: '',
  maxVisitsPerDay: '1',
}

export function ProgramEditor() {
  const { programId } = useParams<{ programId: string }>()
  const isEditing = !!programId
  const navigate = useNavigate()
  const { programs, createProgram, updateProgram } = useProgramsStore()
  const [form, setForm] = useState<Form>(DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      minPointsToRedeem: pc?.minPointsToRedeem?.toString() ?? DEFAULTS.minPointsToRedeem,
      centPerPoint: pc?.centPerPoint?.toString() ?? DEFAULTS.centPerPoint,
      pointsPerCent: pc?.pointsPerCent?.toString() ?? DEFAULTS.pointsPerCent,
      allowPartialRedemption: pc?.allowPartialRedemption ?? true,
      visitsTarget: vc?.visitsTarget?.toString() ?? DEFAULTS.visitsTarget,
      rewardDescription: vc?.rewardDescription ?? '',
      maxVisitsPerDay: (pc?.maxVisitsPerDay ?? vc?.maxVisitsPerDay ?? 1).toString(),
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
        }
      : {
          visitsTarget: parseInt(form.visitsTarget),
          rewardDescription: form.rewardDescription,
          maxVisitsPerDay: parseInt(form.maxVisitsPerDay),
        }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isEditing && programId) {
        await updateProgram(programId, { programName: form.programName, description: form.description, brandColor: form.brandColor }, buildConfig())
        navigate(`/programas/${programId}`)
      } else {
        const created = await createProgram({
          name: form.programName,
          type: form.type,
          programName: form.programName,
          description: form.description,
          brandColor: form.brandColor,
          config: buildConfig(),
        })
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
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`rounded-lg border-2 px-3 py-3 text-left text-sm ${form.type === t ? 'border-primary bg-primary/5' : 'border-gray-200'}`}
                  >
                    <p className="font-bold">{t === 'points' ? '⭐ Puntos' : '🎯 Visitas'}</p>
                    <p className="text-xs text-gray-500">{t === 'points' ? 'Ganan puntos por compra' : 'Cuentan visitas hasta un objetivo'}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

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
            <label className="mb-2 block text-sm font-semibold text-gray-700">Color principal</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, brandColor: c }))}
                  style={{ backgroundColor: c }}
                  className={`h-8 w-8 rounded-lg ${form.brandColor === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`} />
              ))}
              <input value={form.brandColor} onChange={e => setForm(f => ({ ...f, brandColor: e.target.value }))}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-xs font-mono" />
            </div>
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
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-gray-700">Máximo de acumulaciones por día (antifraude)</label>
            <select value={form.maxVisitsPerDay} onChange={e => setForm(f => ({ ...f, maxVisitsPerDay: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
              {['1', '2', '3', '5'].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear programa'}
          </button>
        </form>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-700">Vista previa</p>
          <WalletPassPreview
            program={{ type: form.type, brandColor: form.brandColor, programName: form.programName || 'Mi programa', description: form.description || 'Acumula y gana beneficios' }}
            config={form.type === 'visits' ? { visitsTarget: parseInt(form.visitsTarget) || 10 } : { centPerPoint: parseInt(form.centPerPoint) || 100 }}
          />
        </div>
      </div>
    </div>
  )
}
