import type { AudienceFilter, CustomRegistrationField } from '@/types/loyalty'

const SEGMENT_OPTIONS: { value: AudienceFilter['segment']; label: string }[] = [
  { value: undefined, label: 'Cualquiera' },
  { value: 'active', label: 'Activos' },
  { value: 'at_risk', label: 'En riesgo' },
  { value: 'lapsed', label: 'Inactivos' },
  { value: 'vip', label: 'VIP' },
]

interface Props {
  value: AudienceFilter
  onChange: (next: AudienceFilter) => void
  customFieldOptions: CustomRegistrationField[]
}

export function AudienceFilterEditor({ value, onChange, customFieldOptions }: Props) {
  const activeCustomFieldIds = new Set((value.customFieldFilters ?? []).map(f => f.fieldId))

  function toggleCustomField(field: CustomRegistrationField, on: boolean) {
    const current = value.customFieldFilters ?? []
    if (on) {
      onChange({ ...value, customFieldFilters: [...current, { fieldId: field.id, value: '' }] })
    } else {
      onChange({ ...value, customFieldFilters: current.filter(f => f.fieldId !== field.id) })
    }
  }

  function setCustomFieldValue(fieldId: string, v: string) {
    onChange({
      ...value,
      customFieldFilters: (value.customFieldFilters ?? []).map(f => f.fieldId === fieldId ? { ...f, value: v } : f),
    })
  }

  return (
    <div className="space-y-3 rounded-lg bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Segmento</label>
          <select
            value={value.segment ?? ''}
            onChange={e => onChange({ ...value, segment: (e.target.value || undefined) as AudienceFilter['segment'] })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          >
            {SEGMENT_OPTIONS.map(o => <option key={o.label} value={o.value ?? ''}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Género</label>
          <select
            value={value.gender ?? ''}
            onChange={e => onChange({ ...value, gender: (e.target.value || undefined) as AudienceFilter['gender'] })}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Cualquiera</option>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Edad mínima</label>
          <input
            type="number" min={0} max={120}
            value={value.minAge ?? ''}
            onChange={e => onChange({ ...value, minAge: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Sin mínimo"
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Edad máxima</label>
          <input
            type="number" min={0} max={120}
            value={value.maxAge ?? ''}
            onChange={e => onChange({ ...value, maxAge: e.target.value ? parseInt(e.target.value) : undefined })}
            placeholder="Sin máximo"
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm"
          />
        </div>
      </div>
      {(value.minAge != null || value.maxAge != null) && (
        <p className="text-xs text-gray-400">Solo aplica a clientes que dieron su fecha de nacimiento al registrarse.</p>
      )}

      {customFieldOptions.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Campos personalizados</label>
          <div className="space-y-1.5">
            {customFieldOptions.map(field => (
              <div key={field.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={activeCustomFieldIds.has(field.id)}
                  onChange={e => toggleCustomField(field, e.target.checked)}
                />
                <span className="w-1/3 shrink-0 truncate text-xs text-gray-600">{field.label}</span>
                {activeCustomFieldIds.has(field.id) && (
                  <input
                    value={(value.customFieldFilters ?? []).find(f => f.fieldId === field.id)?.value ?? ''}
                    onChange={e => setCustomFieldValue(field.id, e.target.value)}
                    placeholder="Valor exacto"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
