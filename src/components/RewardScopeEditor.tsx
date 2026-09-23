import { useMemo, useState } from 'react'
import { effectiveScopeMode, scopeModesFor, type RewardConfigDraft, type RewardScopeMode } from '@/lib/rewardConfig'
import type { PosCatalogProduct, RewardType } from '@/types/loyalty'

type ScopePatch = Partial<Pick<RewardConfigDraft, 'scopeMode' | 'scopeCategories' | 'scopeProducts'>>

interface Props {
  type: RewardType
  draft: RewardConfigDraft
  onChange: (patch: ScopePatch) => void
  // Catálogo del POS vinculado — vacío si no hay POS o no cargó. Sin catálogo
  // el dueño aún puede escribir categorías/productos a mano (el POS compara
  // por nombre cuando no hay ids).
  catalog: PosCatalogProduct[]
}

function modeLabel(type: RewardType, mode: RewardScopeMode): string {
  if (mode === 'ticket') return 'Toda la cuenta'
  if (mode === 'categories') return 'Categorías'
  return type === 'bxgy' ? 'Un producto' : 'Productos específicos'
}

function modeHint(type: RewardType, mode: RewardScopeMode): string {
  if (mode === 'ticket') return 'El descuento se aplica al total del ticket.'
  if (mode === 'categories') {
    return type === 'bxgy'
      ? 'Aplica a cualquier producto de esas categorías; las unidades gratis son las de menor precio.'
      : 'Solo se descuenta de los productos de esas categorías.'
  }
  return type === 'bxgy' ? 'Aplica a un solo producto.' : 'Solo se descuenta de esos productos.'
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export function RewardScopeEditor({ type, draft, onChange, catalog }: Props) {
  const modes = scopeModesFor(type)
  const mode = effectiveScopeMode(type, draft)
  const [manualCategory, setManualCategory] = useState('')
  const [manualProduct, setManualProduct] = useState('')

  const catalogCategories = useMemo(() => {
    const names: string[] = []
    for (const p of catalog) {
      if (p.category?.trim() && !names.some(n => sameName(n, p.category))) names.push(p.category.trim())
    }
    return names.sort((a, b) => a.localeCompare(b, 'es'))
  }, [catalog])

  // Un producto por nombre: en multi-sucursal el mismo producto tiene un id
  // por sucursal, y el premio debe valer en todas.
  const catalogProductNames = useMemo(() => {
    const names: string[] = []
    for (const p of catalog) {
      if (p.name?.trim() && !names.some(n => sameName(n, p.name))) names.push(p.name.trim())
    }
    return names.sort((a, b) => a.localeCompare(b, 'es'))
  }, [catalog])

  if (!mode) return null

  // Categorías guardadas que ya no están en el catálogo (o sin POS) — se
  // muestran igual para que el dueño pueda quitarlas.
  const categoryOptions = [
    ...catalogCategories,
    ...draft.scopeCategories.filter(c => !catalogCategories.some(n => sameName(n, c))),
  ]

  function toggleCategory(category: string) {
    const selected = draft.scopeCategories.some(c => sameName(c, category))
    onChange({
      scopeCategories: selected
        ? draft.scopeCategories.filter(c => !sameName(c, category))
        : [...draft.scopeCategories, category],
    })
  }

  function addManualCategory() {
    const value = manualCategory.trim()
    if (value && !draft.scopeCategories.some(c => sameName(c, value))) {
      onChange({ scopeCategories: [...draft.scopeCategories, value] })
    }
    setManualCategory('')
  }

  function addProduct(name: string) {
    const value = name.trim()
    if (!value || draft.scopeProducts.some(p => sameName(p.name, value))) return
    const posProductIds = catalog.filter(p => sameName(p.name, value)).map(p => p.id)
    onChange({ scopeProducts: [...draft.scopeProducts, { name: value, posProductIds }] })
  }

  function removeProduct(name: string) {
    onChange({ scopeProducts: draft.scopeProducts.filter(p => !sameName(p.name, name)) })
  }

  const availableProductNames = catalogProductNames.filter(n => !draft.scopeProducts.some(p => sameName(p.name, n)))

  return (
    <div className="md:col-span-2" data-testid="reward-scope">
      <p className="mb-1.5 text-sm font-semibold text-gray-700">¿A qué aplica?</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="¿A qué aplica?">
        {modes.map(m => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => onChange({ scopeMode: m })}
            className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === m ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {modeLabel(type, m)}
          </button>
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-400">{modeHint(type, mode)}</p>

      {mode === 'categories' && (
        <div className="mt-3">
          {categoryOptions.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {categoryOptions.map(category => {
                const selected = draft.scopeCategories.some(c => sameName(c, category))
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleCategory(category)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      selected ? 'border-primary bg-primary text-white' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                )
              })}
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={manualCategory}
              onChange={e => setManualCategory(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addManualCategory() } }}
              placeholder={catalogCategories.length > 0 ? 'Otra categoría (escribe el nombre tal cual está en el POS)' : 'Nombre de la categoría, tal cual está en el POS'}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button type="button" onClick={addManualCategory}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">
              Agregar categoría
            </button>
          </div>
        </div>
      )}

      {mode === 'products' && type !== 'bxgy' && (
        <div className="mt-3">
          {draft.scopeProducts.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {draft.scopeProducts.map(p => (
                <span key={p.name} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  {p.name}
                  <button type="button" aria-label={`Quitar ${p.name}`} onClick={() => removeProduct(p.name)}
                    className="ml-0.5 rounded-full px-1 leading-none hover:bg-white/20">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableProductNames.length > 0 && (
            <select
              value=""
              onChange={e => addProduct(e.target.value)}
              aria-label="Agregar producto del catálogo"
              className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="">Agregar producto del catálogo…</option>
              {availableProductNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          <div className="flex gap-2">
            <input
              value={manualProduct}
              onChange={e => setManualProduct(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProduct(manualProduct); setManualProduct('') } }}
              placeholder="O escribe el nombre del producto a mano"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button type="button" onClick={() => { addProduct(manualProduct); setManualProduct('') }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600">
              Agregar producto
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
