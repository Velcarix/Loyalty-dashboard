// Helpers puros para las métricas de escaneo del dashboard.
// Los arreglos por día vienen del backend con índice 0 = domingo (EXTRACT DOW).

export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
/** Orden de despliegue: la semana empieza en lunes. */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export interface Extremes {
  maxValue: number
  minValue: number
  /** Índices (del arreglo original) empatados en el máximo, en el orden dado. */
  maxIndices: number[]
  minIndices: number[]
}

/** Días/horas con más y menos escaneos. null si no hubo ningún escaneo. */
export function findExtremes(values: number[], order: number[] = values.map((_, i) => i)): Extremes | null {
  const ordered = order.filter(i => i >= 0 && i < values.length)
  if (ordered.length === 0 || ordered.every(i => values[i] === 0)) return null
  const maxValue = Math.max(...ordered.map(i => values[i]))
  const minValue = Math.min(...ordered.map(i => values[i]))
  return {
    maxValue,
    minValue,
    maxIndices: ordered.filter(i => values[i] === maxValue),
    minIndices: ordered.filter(i => values[i] === minValue),
  }
}

/** "Lunes", "Lunes y Martes", "Lunes, Martes y Jueves", "Lunes, Martes, Jueves y 2 más". */
export function joinNames(names: string[], maxShown = 3): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length > maxShown) return `${names.slice(0, maxShown).join(', ')} y ${names.length - maxShown} más`
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`
}

export function formatHour(hour: number): string {
  return `${String(hour % 24).padStart(2, '0')}:00`
}

export function formatHourRange(hour: number): string {
  return `${formatHour(hour)} – ${formatHour(hour + 1)}`
}

// Nombres y correos los escribe el cliente final en el registro público: una
// celda que empiece con = + - @ se ejecutaría como fórmula al abrir el CSV en Excel.
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows: string[][]): string {
  // BOM para que Excel respete acentos al abrir el archivo.
  return '﻿' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}
