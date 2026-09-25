import { RewardScopeEditor } from '@/components/RewardScopeEditor'
import { showsSingleProductPicker, type RewardConfigDraft } from '@/lib/rewardConfig'
import type { PosCatalogError } from '@/store/programsStore'
import type { PosCatalogProduct, RewardType } from '@/types/loyalty'

interface Props {
  type: RewardType
  draft: RewardConfigDraft
  onChange: (update: (draft: RewardConfigDraft) => RewardConfigDraft) => void
  /** Solo para el selector de un producto: true = texto libre en vez del catálogo. */
  manualProductEntry: boolean
  onManualProductEntryChange: (manual: boolean) => void
  posLinked: boolean
  posCatalog: PosCatalogProduct[]
  isLoadingPosCatalog: boolean
  posCatalogError: PosCatalogError
}

/**
 * Qué da un premio según su tipo: producto(s), porcentaje, monto, "lleva N,
 * paga M" y a qué parte del ticket aplica. Lo comparten "Nueva recompensa" y
 * el "Premio principal" para que ambos se configuren igual. Se renderiza dentro
 * de una rejilla de 2 columnas.
 */
export function RewardConfigFields({
  type, draft, onChange, manualProductEntry, onManualProductEntryChange,
  posLinked, posCatalog, isLoadingPosCatalog, posCatalogError,
}: Props) {
  const catalogAvailable = posLinked && posCatalogError === null && posCatalog.length > 0
  const multiBranchCatalog = new Set(posCatalog.map(p => p.branchId)).size > 1
  const set = (patch: Partial<RewardConfigDraft>) => onChange(c => ({ ...c, ...patch }))
  // Producto gratis con catálogo: las opciones se eligen en el editor de alcance.
  // Sin catálogo (o si no cargó) se escribe a mano, salvo que ya traiga opciones.
  const showScopeEditor = type !== 'free_product'
    || catalogAvailable || draft.scopeProducts.length > 0 || draft.scopeMode === 'categories'

  return (
    <>
      {showsSingleProductPicker(type, draft, catalogAvailable) && (
        <div className="md:col-span-2">
          {catalogAvailable && !manualProductEntry ? (
            <div className="flex gap-2">
              <select
                value={draft.posProductId}
                onChange={e => {
                  const selected = posCatalog.find(p => p.id === e.target.value)
                  set({ posProductId: e.target.value, productName: selected?.name ?? draft.productName })
                }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Selecciona un producto del catálogo</option>
                {posCatalog.map(p => (
                  <option key={p.id} value={p.id}>{multiBranchCatalog ? `${p.name} — ${p.branchName}` : p.name}</option>
                ))}
              </select>
              <button type="button" onClick={() => onManualProductEntryChange(true)}
                className="whitespace-nowrap text-xs font-semibold text-gray-500 underline">
                Escribir a mano
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={draft.productName}
                onChange={e => set({ productName: e.target.value, posProductId: '' })}
                placeholder="Producto/servicio a entregar"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
              {catalogAvailable && (
                <button type="button" onClick={() => onManualProductEntryChange(false)}
                  className="whitespace-nowrap text-xs font-semibold text-gray-500 underline">
                  Elegir del catálogo
                </button>
              )}
            </div>
          )}
          {posLinked && isLoadingPosCatalog && (
            <p className="mt-1 text-xs text-gray-400">Cargando catálogo del POS…</p>
          )}
          {posLinked && posCatalogError === 'unavailable' && (
            <p className="mt-1 text-xs text-amber-600">No se pudo cargar el catálogo del POS — escribe el producto a mano.</p>
          )}
        </div>
      )}
      {type === 'pct_discount' && (
        <input value={draft.discountPct} onChange={e => set({ discountPct: e.target.value })} type="number" min={1} max={100} placeholder="% de descuento"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      )}
      {type === 'fixed_discount' && (
        <input value={draft.discountCents} onChange={e => set({ discountCents: e.target.value })} type="number" min={0} step="0.01" placeholder="Monto ($)"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      )}
      {type === 'bxgy' && (
        <>
          <input value={draft.takeQty} onChange={e => set({ takeQty: e.target.value })} type="number" min={2} placeholder="Lleva (ej. 2)"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input value={draft.payQty} onChange={e => set({ payQty: e.target.value })} type="number" min={1} placeholder="Paga (ej. 1)"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 md:col-span-2">Ej. "Lleva 2, paga 1" = 2x1: se cobra 1 unidad y la otra sale gratis.</p>
        </>
      )}
      {showScopeEditor && (
        <RewardScopeEditor
          type={type}
          draft={draft}
          onChange={patch => set(patch)}
          posLinked={posLinked}
          catalog={posLinked && posCatalogError === null ? posCatalog : []}
          catalogLoading={isLoadingPosCatalog}
          catalogFailed={posLinked && posCatalogError !== null}
        />
      )}
      {type === 'bonus_points' && (
        <input value={draft.bonusPoints} onChange={e => set({ bonusPoints: e.target.value })} type="number" placeholder="Puntos bonus"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      )}
    </>
  )
}

/**
 * Un producto gratis viejo ligado a UN producto del catálogo se abre como una
 * lista de opciones con esa única opción, para poder agregarle más.
 */
export function withLegacyProductAsOption(type: RewardType, draft: RewardConfigDraft): RewardConfigDraft {
  if (type !== 'free_product' || draft.scopeProducts.length > 0 || draft.scopeMode === 'categories' || !draft.posProductId) return draft
  return {
    ...draft,
    scopeMode: 'products',
    scopeProducts: [{ name: draft.productName || 'Producto', posProductIds: [draft.posProductId] }],
  }
}
