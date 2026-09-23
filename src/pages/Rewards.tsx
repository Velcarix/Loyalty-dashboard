import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useProgramsStore } from '@/store/programsStore'
import { AudienceFilterEditor } from '@/components/AudienceFilterEditor'
import { RewardScopeEditor } from '@/components/RewardScopeEditor'
import {
  REWARD_CONFIG_DEFAULTS, buildRewardConfig, parseRewardConfig, validateRewardDraft, describeRewardConfig,
  showsSingleProductPicker, type RewardConfigDraft,
} from '@/lib/rewardConfig'
import type { AudienceFilter, LoyaltyReward, LoyaltyVisitsConfig, RewardType } from '@/types/loyalty'

const REWARD_TYPES: { key: RewardType; label: string; hint: string }[] = [
  { key: 'free_product', label: 'Producto/servicio gratis', hint: 'Ej: corte de cabello gratis' },
  { key: 'pct_discount', label: 'Descuento %', hint: 'Ej: 15% de descuento' },
  { key: 'fixed_discount', label: 'Descuento fijo', hint: 'Ej: $50 de descuento' },
  { key: 'bxgy', label: 'Lleva N, paga M', hint: 'Ej: 2x1, 3x2' },
]

// "Exclusivo VIP" ya no se ofrece al crear: no producía ningún beneficio en el
// canje (effect vacío) y su exclusividad dependía de niveles por puntos que un
// programa de visitas no tiene — "Restringir a cierto público" cubre ese caso.
// Se conserva la etiqueta para mostrar premios viejos de ese tipo.
const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  free_product: 'Producto/servicio gratis',
  pct_discount: 'Descuento %',
  fixed_discount: 'Descuento fijo',
  bxgy: 'Lleva N, paga M',
  bonus_points: 'Puntos bonus',
  vip_exclusive: 'Exclusivo VIP',
}

interface Form {
  type: RewardType
  name: string
  description: string
  pointsRequired: string
}

const FORM_DEFAULTS: Form = { type: 'free_product', name: '', description: '', pointsRequired: '' }

export function Rewards() {
  const { programId } = useParams<{ programId: string }>()
  const { posLink } = useAuthStore()
  const {
    rewards, isLoadingRewards, loadRewards, createReward, updateReward, deleteReward, getProgram, updateVisitsConfig,
    posCatalog, isLoadingPosCatalog, posCatalogError, loadPosCatalog,
  } = useProgramsStore()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<LoyaltyReward | null>(null)
  const [form, setForm] = useState<Form>(FORM_DEFAULTS)
  const [configDraft, setConfigDraft] = useState<RewardConfigDraft>(REWARD_CONFIG_DEFAULTS)
  // false = mostrar el selector del catálogo del POS en vez del campo de texto
  // libre — solo tiene efecto cuando posProductPickerAvailable es true.
  const [manualProductEntry, setManualProductEntry] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [restricted, setRestricted] = useState(false)
  const [eligibility, setEligibility] = useState<AudienceFilter>({})
  // Si se marca, el cambio (crear/editar/borrar) se propaga a los clientes
  // que ya tienen wallet — ver LoyaltyCustomerRewardTier en el backend. Si
  // no, solo afecta wallets nuevas de aquí en adelante.
  const [applyToExisting, setApplyToExisting] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteApplyExisting, setDeleteApplyExisting] = useState(false)
  // Premio principal (nivel base): vive en LoyaltyVisitsConfig, no en
  // loyalty_rewards. Se edita aquí para que todos los premios del programa se
  // configuren en un solo lugar — el editor de programa ya no lo toca.
  const [baseVisits, setBaseVisits] = useState('')
  const [baseReward, setBaseReward] = useState('')
  const [baseApplyExisting, setBaseApplyExisting] = useState(false)
  const [savingBase, setSavingBase] = useState(false)
  const [baseError, setBaseError] = useState('')
  const [baseNotice, setBaseNotice] = useState('')

  const programFull = programId ? getProgram(programId) : undefined
  const program = programFull?.program ?? null
  const visitsConfig = (programFull?.config ?? null) as LoyaltyVisitsConfig | null
  const customFieldOptions = program?.customFields ?? []
  // El campo pointsRequired es genérico en el backend (loyalty_rewards) — en un
  // programa de visitas representa el número de visitas necesarias para ese
  // nivel. Ver reward-tiers.service.ts en el backend.
  const isVisitsProgram = program?.type === 'visits'
  const unitLabel = 'visitas'

  useEffect(() => { if (programId) void loadRewards(programId) }, [programId])

  // El catálogo es del negocio (no del programa) — se carga una vez, solo si
  // hay un POS vinculado. loadPosCatalog ya es un no-op si ya se cargó o está
  // cargando (ver programsStore).
  useEffect(() => { if (posLink?.linked) void loadPosCatalog() }, [posLink?.linked])

  const posProductPickerAvailable = !!posLink?.linked && posCatalogError === null && posCatalog.length > 0
  const multiBranchCatalog = useMemo(() => new Set(posCatalog.map(p => p.branchId)).size > 1, [posCatalog])

  useEffect(() => {
    if (!visitsConfig) return
    setBaseVisits(String(visitsConfig.visitsTarget ?? ''))
    setBaseReward(visitsConfig.rewardDescription ?? '')
  }, [visitsConfig?.programId, visitsConfig?.visitsTarget, visitsConfig?.rewardDescription])

  async function handleSaveBase() {
    if (!programId || !visitsConfig) return
    const target = Number.parseInt(baseVisits, 10)
    if (!Number.isInteger(target) || target < 1) {
      setBaseError('Las visitas para ganar el premio deben ser un número mayor a 0.')
      return
    }
    if (!baseReward.trim()) {
      setBaseError('Escribe qué se lleva el cliente al llegar a la meta.')
      return
    }
    setSavingBase(true)
    setBaseError('')
    setBaseNotice('')
    const propagated = baseApplyExisting
    try {
      await updateVisitsConfig(programId, {
        visitsTarget: target,
        rewardDescription: baseReward.trim(),
        maxVisitsPerDay: visitsConfig.maxVisitsPerDay,
        visualStyle: visitsConfig.visualStyle,
        applyToExistingCustomers: baseApplyExisting,
      })
      setBaseApplyExisting(false)
      setBaseNotice(
        propagated
          ? 'Premio principal guardado. Los clientes actuales se actualizarán en unos segundos.'
          : 'Premio principal guardado. Aplica a las wallets nuevas.',
      )
    } catch (err) {
      setBaseError(err instanceof Error ? err.message : 'No se pudo guardar el premio principal')
    } finally {
      setSavingBase(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setError('')
    setNotice('')
    setForm(FORM_DEFAULTS)
    setConfigDraft(REWARD_CONFIG_DEFAULTS)
    setManualProductEntry(false)
    setRestricted(false)
    setEligibility({})
    setApplyToExisting(false)
    setShowForm(true)
  }

  function openEdit(r: LoyaltyReward) {
    setEditing(r)
    setError('')
    setNotice('')
    setForm({ type: r.type, name: r.name, description: r.description, pointsRequired: String(r.pointsRequired) })
    const draft = parseRewardConfig(r.config)
    setConfigDraft(draft)
    // Si ya estaba ligado a un producto del catálogo, arranca en modo selector
    // (y lo preselecciona); si no, arranca en texto libre para no perder lo
    // que ya tenía escrito. El dueño puede cambiar de modo en cualquier caso.
    setManualProductEntry(!draft.posProductId)
    setRestricted(!!r.eligibility)
    setEligibility(r.eligibility ?? {})
    setApplyToExisting(false)
    setShowForm(true)
  }

  async function handleSave() {
    if (!programId) return
    const configError = validateRewardDraft(form.type, configDraft)
    if (configError) {
      setError(configError)
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    const wasEditing = !!editing
    const propagated = applyToExisting
    try {
      const body = {
        type: form.type, name: form.name.trim(), description: form.description.trim(),
        pointsRequired: parseInt(form.pointsRequired) || 0, config: buildRewardConfig(form.type, configDraft),
        eligibility: restricted ? eligibility : null,
        applyToExistingCustomers: applyToExisting,
      }
      if (editing) await updateReward(programId, editing.id, body)
      else await createReward(programId, body)
      setShowForm(false)
      setNotice(
        propagated
          ? `Recompensa ${wasEditing ? 'guardada' : 'creada'}. Los clientes actuales se actualizarán en unos segundos.`
          : `Recompensa ${wasEditing ? 'guardada' : 'creada'}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la recompensa')
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete(rewardId: string) {
    if (!programId) return
    setError('')
    setNotice('')
    const propagated = deleteApplyExisting
    try {
      await deleteReward(programId, rewardId, deleteApplyExisting)
      setConfirmDeleteId(null)
      setDeleteApplyExisting(false)
      setNotice(
        propagated
          ? 'Recompensa eliminada. Se quitará de los clientes actuales en unos segundos.'
          : 'Recompensa eliminada.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar la recompensa')
    }
  }

  return (
    <div>
      {isVisitsProgram && visitsConfig && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-bold text-gray-900">Premio principal</h3>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">Nivel base</span>
          </div>
          <p className="mb-4 text-xs leading-5 text-gray-500">
            Es la meta que ve el cliente en su tarjeta. Abajo puedes agregar niveles adicionales que requieran
            menos o más {unitLabel} que esta meta (ej. 2 visitas → 20% descuento, 20 visitas → producto especial).
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Visitas para ganar el premio</span>
              <input type="number" min={1} value={baseVisits} onChange={e => setBaseVisits(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold text-gray-700">Premio</span>
              <input value={baseReward} onChange={e => setBaseReward(e.target.value)} placeholder="Ej: Café americano gratis"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            </label>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Aplicar a usuarios actuales</span>
              <input type="checkbox" checked={baseApplyExisting} onChange={e => setBaseApplyExisting(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
            <p className="mt-1 text-xs text-gray-400">
              {baseApplyExisting
                ? 'La meta y el premio nuevos se actualizan también para los clientes que ya tienen wallet.'
                : 'Solo aplica a wallets nuevas — los clientes actuales conservan la meta/premio con la que ya venían.'}
            </p>
          </div>

          {baseError && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{baseError}</p>}
          {baseNotice && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">{baseNotice}</p>}

          <div className="mt-4">
            <button onClick={handleSaveBase} disabled={savingBase}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {savingBase ? 'Guardando…' : 'Guardar premio principal'}
            </button>
          </div>
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <button onClick={openCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">+ Nueva recompensa</button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</p>
      )}

      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">{notice}</p>
      )}

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
            <input value={form.pointsRequired} onChange={e => setForm(f => ({ ...f, pointsRequired: e.target.value }))} type="number" min={0} placeholder="Visitas requeridas (0 = gratis si califica)"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2" />
            {showsSingleProductPicker(form.type, configDraft) && (
              <div className="md:col-span-2">
                {posProductPickerAvailable && !manualProductEntry ? (
                  <div className="flex gap-2">
                    <select
                      value={configDraft.posProductId}
                      onChange={e => {
                        const selected = posCatalog.find(p => p.id === e.target.value)
                        setConfigDraft(c => ({ ...c, posProductId: e.target.value, productName: selected?.name ?? c.productName }))
                      }}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">Selecciona un producto del catálogo</option>
                      {posCatalog.map(p => (
                        <option key={p.id} value={p.id}>{multiBranchCatalog ? `${p.name} — ${p.branchName}` : p.name}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setManualProductEntry(true)}
                      className="whitespace-nowrap text-xs font-semibold text-gray-500 underline">
                      Escribir a mano
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      value={configDraft.productName}
                      onChange={e => setConfigDraft(c => ({ ...c, productName: e.target.value, posProductId: '' }))}
                      placeholder="Producto/servicio a entregar"
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    {posProductPickerAvailable && (
                      <button type="button" onClick={() => setManualProductEntry(false)}
                        className="whitespace-nowrap text-xs font-semibold text-gray-500 underline">
                        Elegir del catálogo
                      </button>
                    )}
                  </div>
                )}
                {posLink?.linked && isLoadingPosCatalog && (
                  <p className="mt-1 text-xs text-gray-400">Cargando catálogo del POS…</p>
                )}
                {posLink?.linked && posCatalogError === 'unavailable' && (
                  <p className="mt-1 text-xs text-amber-600">No se pudo cargar el catálogo del POS — escribe el producto a mano.</p>
                )}
              </div>
            )}
            {form.type === 'pct_discount' && (
              <input value={configDraft.discountPct} onChange={e => setConfigDraft(c => ({ ...c, discountPct: e.target.value }))} type="number" min={1} max={100} placeholder="% de descuento"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            )}
            {form.type === 'fixed_discount' && (
              <input value={configDraft.discountCents} onChange={e => setConfigDraft(c => ({ ...c, discountCents: e.target.value }))} type="number" min={0} step="0.01" placeholder="Monto ($)"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
            )}
            {form.type === 'bxgy' && (
              <>
                <input value={configDraft.takeQty} onChange={e => setConfigDraft(c => ({ ...c, takeQty: e.target.value }))} type="number" min={2} placeholder="Lleva (ej. 2)"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <input value={configDraft.payQty} onChange={e => setConfigDraft(c => ({ ...c, payQty: e.target.value }))} type="number" min={1} placeholder="Paga (ej. 1)"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                <p className="text-xs text-gray-400 md:col-span-2">Ej. "Lleva 2, paga 1" = 2x1: se cobra 1 unidad y la otra sale gratis.</p>
              </>
            )}
            <RewardScopeEditor
              type={form.type}
              draft={configDraft}
              onChange={patch => setConfigDraft(c => ({ ...c, ...patch }))}
              catalog={posLink?.linked && posCatalogError === null ? posCatalog : []}
            />
            {form.type === 'bonus_points' && (
              <input value={configDraft.bonusPoints} onChange={e => setConfigDraft(c => ({ ...c, bonusPoints: e.target.value }))} type="number" placeholder="Puntos bonus"
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
              <p className="text-xs text-gray-400">Abierta a cualquier cliente con las visitas suficientes.</p>
            )}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-700">Aplicar a usuarios actuales</span>
              <input type="checkbox" checked={applyToExisting} onChange={e => setApplyToExisting(e.target.checked)} className="h-4 w-4 accent-primary" />
            </label>
            <p className="mt-1 text-xs text-gray-400">
              {applyToExisting
                ? 'Al guardar, este cambio también se propaga a los clientes que ya tienen wallet (acción única de este guardado).'
                : 'Solo aplica a wallets nuevas — los clientes actuales conservan lo que ya tenían.'}
            </p>
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
                  <p className="mt-1 text-xs text-gray-500">{describeRewardConfig(r.type, r.config, unitLabel)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{r.pointsRequired} {unitLabel}</span>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-bold text-accent">{REWARD_TYPE_LABELS[r.type]}</span>
                    {r.eligibility && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">Público restringido</span>
                    )}
                  </div>
                </div>
              </div>
              {confirmDeleteId === r.id ? (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <label className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Aplicar también a usuarios actuales</span>
                    <input type="checkbox" checked={deleteApplyExisting} onChange={e => setDeleteApplyExisting(e.target.checked)} className="h-4 w-4 accent-primary" />
                  </label>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => { setConfirmDeleteId(null); setDeleteApplyExisting(false) }} className="flex-1 rounded-lg bg-gray-50 py-1.5 text-xs font-semibold text-gray-700">Cancelar</button>
                    <button onClick={() => handleConfirmDelete(r.id)} className="flex-1 rounded-lg bg-red-50 py-1.5 text-xs font-semibold text-red-600">Confirmar</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
                  <button onClick={() => openEdit(r)} className="flex-1 rounded-lg bg-gray-50 py-1.5 text-xs font-semibold text-gray-700">Editar</button>
                  <button onClick={() => setConfirmDeleteId(r.id)} className="flex-1 rounded-lg bg-red-50 py-1.5 text-xs font-semibold text-red-600">Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
