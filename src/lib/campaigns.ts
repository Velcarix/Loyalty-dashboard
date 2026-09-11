// Helpers puros de la pestaña Campañas. daysOfWeek usa 0 = domingo (igual que el backend).

export const DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
/** Orden de despliegue: la semana empieza en lunes. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

export type CampaignStatus = 'active' | 'paused' | 'scheduled' | 'ended'

export function campaignStatus(
  campaign: { isActive: boolean; startsAt: string | null; endsAt: string | null },
  now: Date = new Date(),
): CampaignStatus {
  if (!campaign.isActive) return 'paused'
  if (campaign.endsAt && new Date(campaign.endsAt) < now) return 'ended'
  if (campaign.startsAt && new Date(campaign.startsAt) > now) return 'scheduled'
  return 'active'
}

export function describeDays(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 0 || daysOfWeek.length === 7) return 'Todos los días'
  return WEEK_ORDER.filter(d => daysOfWeek.includes(d)).map(d => DAY_SHORT[d]).join(', ')
}

export function describeHours(start: string | null, end: string | null): string {
  if (start && end) return `${start} – ${end}`
  if (start) return `desde ${start}`
  if (end) return `hasta ${end}`
  return 'todo el día'
}

/** Tipo de campaña según lo que configuró el merchant (el backend solo lo guarda como etiqueta). */
export function campaignTypeFor(opts: { hasTimeWindow: boolean; hasDates: boolean }): 'happy_hour' | 'time_limited' | 'double_points' {
  if (opts.hasTimeWindow) return 'happy_hour'
  if (opts.hasDates) return 'time_limited'
  return 'double_points'
}

/** 'YYYY-MM-DD' de un <input type="date"> → ISO del inicio o fin de ese día local. */
export function localDateToIso(date: string, endOfDay: boolean): string {
  const [year, month, day] = date.split('-').map(Number)
  const value = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0)
  return value.toISOString()
}

export function multiplierLabel(multiplier: string | number | null): string {
  const value = Number(multiplier ?? 1)
  return Number.isInteger(value) ? `x${value}` : `x${value.toFixed(1)}`
}
