export interface ProgramSection {
  to: string
  label: string
  end?: boolean
}

export const programSections: ProgramSection[] = [
  { to: '', label: 'Dashboard', end: true },
  { to: 'clientes', label: 'Clientes' },
  { to: 'rewards', label: 'Recompensas' },
  { to: 'transacciones', label: 'Transacciones' },
  { to: 'anomalias', label: 'Anomalías' },
  { to: 'datos-a-solicitar', label: 'Datos a solicitar' },
  { to: 'notificaciones', label: 'Notificaciones' },
  { to: 'automatizaciones', label: 'Automatizaciones' },
  { to: 'campanas', label: 'Campañas' },
  { to: 'resenas-y-cercania', label: 'Reseñas y cercanía' },
]
