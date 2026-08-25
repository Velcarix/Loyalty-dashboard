import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import { AudienceFilterEditor } from '@/components/AudienceFilterEditor'
import type { AudienceFilter, LoyaltyReward, RewardType } from '@/types/loyalty'

const REWARD_TYPES: { key: RewardType; label: string; hint: string }[] = [
  { key: 'free_product', label: 'Producto/servicio gratis', hint: 'Ej: corte de cabello gratis' },
  { key: 'pct_discount', label: 'Descuento %', hint: 'Ej: 15% de descuento' },
  { key: 'fixed_discount', label: 'Descuento fijo', hint: 'Ej: $50 de descuento' },
  { key: 'bxgy', label: 'Compra X lleva Y', hint: 'Ej: 2x1 en bebidas' },
  { key: 'bonus_points', label: 'Puntos extra', hint: 'Ej: 20 puntos bonus' },
  { key: 'vip_exclusive', label: 'Exclusivo VIP', hint: 'Solo para un nivel mínimo' },
]

interface Form {
  type: RewardType
  name: string
  description: string
  pointsRequired: string
  productName: string
  discountPct: string
  discountCents: string
  buyQty: string
  getQty: string
  bonusPoints: string
}

const FORM_DEFAULTS: Form = {
  type: 'free_product', name: '', description: '', pointsRequired: '',
  productName: '', discountPct: '', discountCents: '', buyQty: '2', getQty: '1', bonusPoints: '',
}

function buildConfig(form: Form): Record<string, unknown> {
  switch (form.type) {
    case 'free_product': return { productName: form.productName }
    case 'pct_discount': return { discountPct: parseInt(form.discountPct) || 0 }
    case 'fixed_discount': return { discountCents: Math.round((parseFloat(form.discountCents) || 0) * 100) }
    case 'bxgy': return { productName: form.productName, buyQty: parseInt(form.buyQty) || 1, getQty: parseInt(form.getQty) || 1 }
    case 'bonus_points': return { bonusPoints: parseInt(form.bonusPoints) || 0 }
    case 'vip_exclusive': return {}
  }
}

export function Rewards() {
  const { programId } = useParams<{ programId: string }>()
  const { rewards, isLoadingRewards, loadRewards, createReward, updateReward, deleteReward, getProgram } = useProgramsStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LoyaltyReward | null>(null)
  const [form, setForm] = useState<Form>(FORM_DEFAULTS)
  const [saving, setSaving] = useState(false)
  const [restricted, setRestricted] = useState(false)
  const [eligibility, setEligibility] = useState<AudienceFilter>({})

  const program = programId ? getProgram(programId)?.program : null
  const customFieldOptions = program?.customFields ?? []
  // El campo pointsRequired es genérico en el backend (loyalty_rewards) — en un
  // programa de visitas representa el número de visitas necesarias para ese
  // nivel, no puntos. Ver reward-tiers.service.ts en el backend.
  const isVisitsProgram = program?.type === 'visits'
  const unitLabel = isVisitsProgram ? 'visitas' : 'puntos'
  const unitLabelSingular = isVisitsProgram ? 'visita' : 'punto'

  useEffect(() => { if (programId) void loadRewards(programId) }, [programId])

  function openCreate() {
    setEditing(null)
    setForm(FORM_DEFAULTS)
    setRestricted(false)
    setEligibility({})
    setShowForm(true)
  }

  function openEdit(r: LoyaltyReward) {
    setEditing(r)
    const c = r.config ?? {}
    setForm({
      type: r.type, name: r.name, description: r.description, pointsRequired: String(r.pointsRequired),
      productName: String(c.productName ?? ''), discountPct: String(c.discountPct ?? ''),
      discountCents: c.discountCents ? String(Number(c.discountCents) / 100) : '',
      buyQty: String(c.buyQty ?? '2'), getQty: String(c.getQty ?? '1'), bonusPoints: String(c.bonusPoints ?? ''),
    })
    setRestricted(!!r.eligibility)
    setEligibility(r.eligibility ?? {})
    setShowForm(true)
  }

  async function handleSave() {
    if (!programId) return
    setSaving(true)
    try {
      const body = {
        type: form.type, name: form.name.trim(), description: form.description.trim(),
        pointsRequired: parseInt(form.pointsRequired) || 0, config: buildConfig(form),
        eligibility: restricted ? eligibility : null,
      }
      if (editing) await updateReward(programId, editing.id, body)
      else await createReward(programId, body)
      setShowForm(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {isVisitsProgram && (
        <p className="mb-4 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
          El nivel base (meta y premio principal) se configura en <strong>Editar → Reglas y recompensa</strong>.
          Agrega aquí niveles adicionales para varios premios por cantidad de visitas — pueden requerir menos o más
          visitas que el premio principal (ej. 2 visitas → 20% descuento, 20 visitas → producto especial).
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">+ Nueva recompensa</button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-bold text-gray-900">{editing ? 'Editar recompensa' : 'Nueva recompensa'}</h3>
          {!editing && (
            <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3">
              {REWARD_TYPES.map(t => (
                <button key={t.key} onClick={() => setForm(f => ({ ...f, type: t.key }))}
                  className={`rounded-lg border-2 px-3 py-2 text-left text-xs ${form.type === t.key ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                  <p className="font-semibold">{t.label}</p>
                  <p className="text-gray-400">{t.hint}</p>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input value={form.pointsRequired} onChange={e => setForm(f => ({ ...f, pointsRequired: e.target.value }))} type="number" min={0} placeholder={`${unitLabelSingular === 'visita' ? 'Visitas' : 'Puntos'} requeridos (0 = gratis si califica)`}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
            {(form.type === 'free_product' || form.type === 'bxgy') && (
              <input value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} placeholder="Producto/servicio a entregar"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            )}
            {form.type === 'pct_discount' && (
              <input value={form.discountPct} onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))} type="number" placeholder="% de descuento"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            )}
            {form.type === 'fixed_discount' && (
              <input value={form.discountCents} onChange={e => setForm(f => ({ ...f, discountCents: e.target.value }))} type="number" placeholder="Monto ($)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            )}
            {form.type === 'bxgy' && (
              <>
                <input value={form.buyQty} onChange={e => setForm(f => ({ ...f, buyQty: e.target.value }))} type="number" placeholder="Compra"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <input value={form.getQty} onChange={e => setForm(f => ({ ...f, getQty: e.target.value }))} type="number" placeholder="Lleva"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </>
            )}
            {form.type === 'bonus_points' && (
              <input value={form.bonusPoints} onChange={e => setForm(f => ({ ...f, bonusPoints: e.target.value }))} type="number" placeholder="Puntos bonus"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            )}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Restringir a cierto público</span>
              <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
            {restricted ? (
              <>
                <p className="mb-2 text-xs text-gray-500">Solo los clientes que califiquen podrán canjearla — se valida al escanear su QR.</p>
                <AudienceFilterEditor value={eligibility} onChange={setEligibility} customFieldOptions={customFieldOptions} />
              </>
            ) : (
              <p className="text-xs text-gray-400">Abierta a cualquier cliente con los puntos suficientes.</p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      )}

      {isLoadingRewards ? (
        <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
      ) : rewards.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-400">Sin recompensas todavía</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {rewards.map(r => (
            <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900">{r.name}{!r.isActive && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactiva</span>}</p>
                  <p className="text-xs text-gray-500">{r.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{r.pointsRequired} {isVisitsProgram ? unitLabel : 'pts'}</span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{REWARD_TYPES.find(t => t.key === r.type)?.label}</span>
                    {r.eligibility && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Público restringido</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => openEdit(r)} className="flex-1 rounded-lg bg-gray-50 py-1.5 text-xs font-semibold text-gray-700">Editar</button>
                <button onClick={() => programId && deleteReward(programId, r.id)} className="flex-1 rounded-lg bg-red-50 py-1.5 text-xs font-semibold text-red-600">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
