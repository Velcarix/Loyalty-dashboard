import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useProgramsStore } from '@/store/programsStore'
import type { CustomRegistrationField } from '@/types/loyalty'

function makeFieldId(): string {
  return `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function RegistrationFields() {
  const { programId } = useParams<{ programId: string }>()
  const { getProgram, updateProgram } = useProgramsStore()
  const program = programId ? getProgram(programId)?.program : undefined

  const [askBirthday, setAskBirthday] = useState(false)
  const [askGender, setAskGender] = useState(false)
  const [customFields, setCustomFields] = useState<CustomRegistrationField[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!program) return
    setAskBirthday(program.askBirthday)
    setAskGender(program.askGender)
    setCustomFields(program.customFields ?? [])
  }, [program?.id])

  function addField() {
    if (customFields.length >= 5) return
    setCustomFields(f => [...f, { id: makeFieldId(), label: '', required: false }])
  }

  function updateField(id: string, patch: Partial<CustomRegistrationField>) {
    setCustomFields(f => f.map(field => field.id === id ? { ...field, ...patch } : field))
  }

  function removeField(id: string) {
    setCustomFields(f => f.filter(field => field.id !== id))
  }

  async function handleSave() {
    if (!programId) return
    const cleanFields = customFields.map(f => ({ ...f, label: f.label.trim() })).filter(f => f.label.length > 0)
    if (cleanFields.some(f => f.label.length > 60)) {
      setError('Las etiquetas de campos custom deben tener 60 caracteres o menos')
      return
    }
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateProgram(programId, { askBirthday, askGender, customFields: cleanFields })
      setCustomFields(cleanFields)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!program) return <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div className="space-y-5 rounded-2xl bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Datos a solicitar</h2>
          <p className="mt-1 text-sm text-gray-500">Elige qué información adicional pides al cliente cuando se une al programa.</p>
        </div>

        <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-gray-900">Fecha de nacimiento</p>
            <p className="text-xs text-gray-400">Con año — habilita filtrar por edad en Notificaciones y Recompensas</p>
          </div>
          <input type="checkbox" checked={askBirthday} onChange={e => setAskBirthday(e.target.checked)} className="h-5 w-5 accent-primary" />
        </label>

        <label className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-gray-900">Género</p>
            <p className="text-xs text-gray-400">Masculino / Femenino</p>
          </div>
          <input type="checkbox" checked={askGender} onChange={e => setAskGender(e.target.checked)} className="h-5 w-5 accent-primary" />
        </label>

        <div className="border-t border-gray-100 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Campos personalizados</p>
            <span className="text-xs text-gray-400">{customFields.length}/5</span>
          </div>

          {customFields.length === 0 && (
            <p className="mb-2 text-xs text-gray-400">Sin campos custom. Agrega uno si necesitas pedir algo que no está arriba.</p>
          )}

          <div className="space-y-2">
            {customFields.map(field => (
              <div key={field.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-2">
                <input
                  value={field.label}
                  onChange={e => updateField(field.id, { label: e.target.value })}
                  placeholder="Ej: Nombre de tu mascota"
                  maxLength={60}
                  className="min-w-0 flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500">
                  <input type="checkbox" checked={field.required} onChange={e => updateField(field.id, { required: e.target.checked })} />
                  Obligatorio
                </label>
                <button type="button" onClick={() => removeField(field.id)} className="shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">✕</button>
              </div>
            ))}
          </div>

          {customFields.length < 5 && (
            <button type="button" onClick={addField} className="mt-2 text-sm font-semibold text-primary">+ Agregar campo</button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">Vista previa del formulario</p>
        <RegistrationFormPreview askBirthday={askBirthday} askGender={askGender} customFields={customFields} brandColor={program.brandColor} />
      </div>
    </div>
  )
}

function RegistrationFormPreview({
  askBirthday, askGender, customFields, brandColor,
}: {
  askBirthday: boolean
  askGender: boolean
  customFields: CustomRegistrationField[]
  brandColor: string
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div style={{ backgroundColor: brandColor }} className="px-6 py-6 text-white">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-sm font-extrabold text-gray-900">•</div>
        <p className="text-lg font-extrabold">Mi programa</p>
        <p className="text-sm opacity-75">Acumula y gana beneficios</p>
      </div>
      <div className="space-y-3 p-6">
        <h3 className="text-base font-bold text-gray-900">Únete al programa</h3>
        <p className="text-xs text-gray-500">Solo tarda un minuto. Tu tarjeta se guarda en tu Wallet.</p>

        <PreviewField label="Nombre completo" placeholder="Juan García" />
        <PreviewField label="Teléfono (10 dígitos)" placeholder="(993) 342-5422" />
        <PreviewField label="Email" placeholder="juan@email.com" />

        {askBirthday && <PreviewField label="Fecha de nacimiento" placeholder="Día / Mes / Año" />}
        {askGender && (
          <div>
            <p className="mb-1 text-xs font-semibold text-gray-700">Género</p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-xs text-gray-400">Masculino</div>
              <div className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-xs text-gray-400">Femenino</div>
            </div>
          </div>
        )}
        {customFields.filter(f => f.label.trim()).map(f => (
          <PreviewField key={f.id} label={`${f.label}${f.required ? ' *' : ''}`} placeholder="" />
        ))}

        <div>
          <p className="mb-1 text-xs font-semibold text-gray-700">PIN de 4 dígitos <span className="font-normal text-gray-400">(para canjear puntos)</span></p>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-9 flex-1 rounded-lg border border-gray-200 bg-gray-50" />)}
          </div>
        </div>

        <div className="pt-2">
          <div className="w-full rounded-lg bg-gray-800 py-2.5 text-center text-sm font-bold text-white opacity-90">Registrarme</div>
        </div>
      </div>
    </div>
  )
}

function PreviewField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-gray-700">{label}</p>
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400">{placeholder}</div>
    </div>
  )
}
