import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

function LocationRow({ location, onRenamed }: { location: { id: string; name: string }; onRenamed: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(location.name)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.put(`/api/v1/merchant/locations/${location.id}`, { name: name.trim() })
      onRenamed()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <input value={name} onChange={e => setName(e.target.value)} autoFocus
          className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm" />
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white">
          {saving ? '…' : 'Guardar'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{location.name}</span>
      <button onClick={() => setEditing(true)} className="text-xs text-primary">Renombrar</button>
    </div>
  )
}

export function Settings() {
  const { merchant, locations, posLink, refreshProfile } = useAuthStore()
  const [pairingCode, setPairingCode] = useState<{ code: string; expiresAt: string } | null>(null)
  const [generating, setGenerating] = useState(false)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => { void refreshProfile() }, [])

  async function handleGenerateCode() {
    setGenerating(true)
    try {
      const data = await api.post<{ code: string; expiresAt: string }>('/api/v1/integrations/pos/code')
      setPairingCode(data)
    } finally {
      setGenerating(false)
    }
  }

  async function handleRevoke() {
    if (!confirm('¿Seguro que quieres desvincular tu POS?')) return
    setRevoking(true)
    try {
      await api.delete('/api/v1/integrations/pos/link')
      await refreshProfile()
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Ajustes</h1>

      <SectionCard title="Cuenta y negocio">
        <p className="font-semibold text-gray-900">{merchant?.businessName}</p>
        <p className="text-xs text-gray-500">{merchant?.email}</p>
        {merchant?.vertical && <p className="mt-1 text-xs text-gray-400">Giro: {merchant.vertical}</p>}
        <span className="mt-2 inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold uppercase text-primary">{merchant?.plan ?? 'trial'}</span>
      </SectionCard>

      <SectionCard title="Ubicaciones">
        {locations.length === 0 ? <p className="text-sm text-gray-400">Sin ubicaciones</p> : (
          locations.map(l => <LocationRow key={l.id} location={l} onRenamed={refreshProfile} />)
        )}
      </SectionCard>

      <SectionCard title="Conectar Copo POS">
        {posLink?.linked ? (
          <div>
            <p className="mb-1 text-sm font-semibold text-green-600">✓ Vinculado</p>
            {posLink.since && <p className="mb-3 text-xs text-gray-400">Desde {new Date(posLink.since).toLocaleDateString('es-MX')}</p>}
            <button onClick={handleRevoke} disabled={revoking} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50">
              {revoking ? 'Desvinculando…' : 'Desvincular'}
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-xs text-gray-500">Genera un código y captúralo en el dashboard de tu Copo POS, sección "Copo Loyalty".</p>
            {pairingCode && (
              <div className="mb-3 rounded-xl bg-primary/10 px-4 py-4 text-center">
                <p className="text-3xl font-bold tracking-widest text-primary">{pairingCode.code}</p>
                <p className="mt-1 text-xs text-gray-500">Expira {new Date(pairingCode.expiresAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
            <button onClick={handleGenerateCode} disabled={generating} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              {generating ? 'Generando…' : pairingCode ? 'Generar otro código' : 'Generar código'}
            </button>
          </div>
        )}
        <p className="mt-4 border-t border-gray-100 pt-4 text-xs text-gray-400">¿No tienes Copo POS? Conócelo en copopos.com</p>
      </SectionCard>
    </div>
  )
}
