/**
 * Exportación de clientes a Excel (.xlsx) con la marca de Copo: encabezado con
 * logo, tarjetas de resumen y tabla con filtros. Se importa con import()
 * dinámico desde la página para que exceljs (~1 MB) no pese en la carga inicial.
 */
import ExcelJS from 'exceljs'
import type { Cell, Workbook, Worksheet } from 'exceljs'
import { api } from '@/lib/api'
import type { LoyaltyCustomer, LoyaltyProgram } from '@/types/loyalty'

// Mismos colores que tailwind.config (primary, ink) + la escala slate del dashboard.
const COLOR = {
  primary: 'FF2563EB',
  primaryDark: 'FF1D4ED8',
  primarySoft: 'FFEFF6FF',
  ink: 'FF0B132B',
  text: 'FF1E293B',
  muted: 'FF64748B',
  faint: 'FF94A3B8',
  border: 'FFE2E8F0',
  zebra: 'FFF8FAFC',
  white: 'FFFFFFFF',
  green: 'FF16A34A',
  amber: 'FFB45309',
}

const SEGMENTS: Record<LoyaltyCustomer['segment'], { label: string; color: string }> = {
  active: { label: 'Activo', color: COLOR.green },
  vip: { label: 'VIP', color: 'FF7C3AED' },
  at_risk: { label: 'En riesgo', color: 'FFD97706' },
  lapsed: { label: 'Inactivo', color: COLOR.muted },
}

const GENDERS: Record<string, string> = { male: 'Masculino', female: 'Femenino' }

const DATE_FMT = 'dd/mm/yyyy'
const DATETIME_FMT = 'dd/mm/yyyy hh:mm'

// Filas del encabezado (1-based, como Excel).
const ROW = { title: 1, subtitle: 2, accent: 3, kpiLabel: 5, kpiValue: 6, header: 8 } as const

export type ExportProgram = Pick<LoyaltyProgram, 'programName' | 'askBirthday' | 'askGender' | 'customFields'>

export interface ExportLogo {
  buffer: ArrayBuffer
  width: number
  height: number
}

export interface CustomersWorkbookInput {
  program: ExportProgram
  customers: LoyaltyCustomer[]
  generatedAt?: Date
  logo?: ExportLogo | null
}

type CellValue = string | number | Date | null

interface Column {
  header: string
  get: (c: LoyaltyCustomer) => CellValue
  align?: 'left' | 'center'
  numFmt?: string
  /** Ancho mínimo en caracteres. */
  minWidth?: number
  style?: (c: LoyaltyCustomer, cell: Cell) => void
}

/**
 * Excel no guarda zona horaria: exceljs escribe el Date como UTC, así que se
 * pasa la fecha/hora local "como si fuera UTC" para que se vea igual que en el dashboard.
 */
function localAsUtc(iso: string | null | undefined, withTime = false): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), withTime ? d.getHours() : 0, withTime ? d.getMinutes() : 0))
}

/** El cumpleaños es una fecha sin hora ("1993-02-02" o medianoche UTC): se toma tal cual. */
function birthdayAsUtc(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
}

/**
 * Teléfono agrupado ("999 555 6677"): se lee mejor y Excel no lo marca como
 * "número guardado como texto" (triangulito verde). Otros formatos se dejan igual.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const group = (d: string) => `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
  if (digits.length === 10) return group(digits)
  if (digits.length === 12 && digits.startsWith('52')) return `+52 ${group(digits.slice(2))}`
  return phone
}

function flag(on: boolean, cell: Cell) {
  cell.font = { ...cell.font, color: { argb: on ? COLOR.green : COLOR.faint }, bold: on }
}

function buildColumns(program: ExportProgram, customers: LoyaltyCustomer[]): Column[] {
  const columns: Column[] = [
    { header: 'Nombre', get: c => c.name, minWidth: 24, style: (_, cell) => { cell.font = { ...cell.font, bold: true, color: { argb: COLOR.ink } } } },
    { header: 'Teléfono', get: c => formatPhone(c.phone), minWidth: 14 },
    { header: 'Correo', get: c => c.email ?? null, minWidth: 22 },
    { header: 'Acepta promociones', get: c => (c.emailConsent ? 'Sí' : 'No'), align: 'center', style: (c, cell) => flag(!!c.emailConsent, cell) },
    { header: 'Visitas', get: c => c.visitsCount, align: 'center', numFmt: '#,##0', minWidth: 9 },
    {
      header: 'Premio por canjear',
      get: c => (c.hasPendingReward ? c.pendingRewardDescription || 'Sí' : 'No'),
      minWidth: 18,
      style: (c, cell) => { cell.font = { ...cell.font, bold: c.hasPendingReward, color: { argb: c.hasPendingReward ? COLOR.amber : COLOR.faint } } },
    },
    {
      header: 'Segmento',
      get: c => SEGMENTS[c.segment]?.label ?? c.segment,
      align: 'center',
      style: (c, cell) => { cell.font = { ...cell.font, bold: true, color: { argb: SEGMENTS[c.segment]?.color ?? COLOR.muted } } },
    },
  ]

  // Datos extra del registro: solo si el programa los pide o algún cliente ya los tiene.
  if (program.askBirthday || customers.some(c => c.birthdayDate)) {
    columns.push({ header: 'Cumpleaños', get: c => birthdayAsUtc(c.birthdayDate), align: 'center', numFmt: DATE_FMT, minWidth: 12 })
  }
  if (program.askGender || customers.some(c => c.gender)) {
    columns.push({ header: 'Género', get: c => (c.gender ? GENDERS[c.gender] ?? c.gender : null), align: 'center' })
  }
  for (const field of program.customFields ?? []) {
    columns.push({ header: field.label, get: c => c.customFieldValues?.[field.id]?.trim() || null, minWidth: 14 })
  }

  columns.push(
    { header: 'Cliente desde', get: c => localAsUtc(c.createdAt), align: 'center', numFmt: DATE_FMT, minWidth: 13 },
    { header: 'Última actividad', get: c => localAsUtc(c.lastActivityAt, true), align: 'center', numFmt: DATETIME_FMT, minWidth: 17 },
  )
  return columns
}

function displayLength(value: CellValue, numFmt?: string): number {
  if (value == null) return 0
  if (value instanceof Date) return (numFmt ?? DATE_FMT).length
  return String(value).length
}

function fillRow(ws: Worksheet, row: number, from: number, to: number, argb: string) {
  for (let col = from; col <= to; col++) {
    ws.getCell(row, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
  }
}

function addHeaderBlock(ws: Worksheet, wb: Workbook, input: CustomersWorkbookInput, lastCol: number, generatedAt: Date) {
  const { program, customers, logo } = input
  ws.getRow(ROW.title).height = 30
  ws.getRow(ROW.subtitle).height = 20
  ws.getRow(ROW.accent).height = 4
  ws.getRow(4).height = 10
  ws.getRow(ROW.kpiLabel).height = 18
  ws.getRow(ROW.kpiValue).height = 28
  ws.getRow(7).height = 14

  // Con logo, el texto arranca en la columna B y el logo ocupa la A.
  const textCol = logo ? 2 : 1
  if (logo) {
    const imageId = wb.addImage({ buffer: logo.buffer, extension: 'png' })
    const height = 50
    ws.addImage(imageId, { tl: { col: 0.12, row: 0.12 }, ext: { width: Math.round((logo.width / logo.height) * height), height } })
  }

  ws.mergeCells(ROW.title, textCol, ROW.title, lastCol)
  const title = ws.getCell(ROW.title, textCol)
  title.value = `Clientes · ${program.programName}`
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: COLOR.ink } }
  title.alignment = { vertical: 'bottom' }

  ws.mergeCells(ROW.subtitle, textCol, ROW.subtitle, lastCol)
  const subtitle = ws.getCell(ROW.subtitle, textCol)
  const date = generatedAt.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  subtitle.value = `Copo Loyalty · Exportado el ${date} · ${customers.length} ${customers.length === 1 ? 'cliente' : 'clientes'}`
  subtitle.font = { name: 'Calibri', size: 10, color: { argb: COLOR.muted } }
  subtitle.alignment = { vertical: 'top' }

  fillRow(ws, ROW.accent, 1, lastCol, COLOR.primary)

  const kpis: [string, number][] = [
    ['Clientes', customers.length],
    ['Aceptan promociones', customers.filter(c => c.emailConsent).length],
    ['Premios por canjear', customers.filter(c => c.hasPendingReward).length],
    ['Visitas registradas', customers.reduce((sum, c) => sum + (c.visitsCount ?? 0), 0)],
  ]
  kpis.forEach(([label, value], i) => {
    const from = 1 + i * 2
    const to = from + 1
    ws.mergeCells(ROW.kpiLabel, from, ROW.kpiLabel, to)
    ws.mergeCells(ROW.kpiValue, from, ROW.kpiValue, to)
    fillRow(ws, ROW.kpiLabel, from, to, COLOR.primarySoft)
    fillRow(ws, ROW.kpiValue, from, to, COLOR.primarySoft)
    const labelCell = ws.getCell(ROW.kpiLabel, from)
    labelCell.value = label.toUpperCase()
    labelCell.font = { name: 'Calibri', size: 8, bold: true, color: { argb: COLOR.muted } }
    labelCell.alignment = { vertical: 'bottom', indent: 1 }
    const valueCell = ws.getCell(ROW.kpiValue, from)
    valueCell.value = value
    valueCell.numFmt = '#,##0'
    valueCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLOR.primary } }
    valueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    // Línea blanca entre tarjetas para que se lean separadas.
    if (i > 0) {
      const edge = { style: 'thick' as const, color: { argb: COLOR.white } }
      labelCell.border = { left: edge }
      valueCell.border = { left: edge }
    }
  })
}

/** Arma el libro de Excel. Separado de la descarga para poder probarlo sin navegador. */
export function buildCustomersWorkbook(input: CustomersWorkbookInput): Workbook {
  const { program, customers } = input
  const generatedAt = input.generatedAt ?? new Date()
  const columns = buildColumns(program, customers)
  const lastCol = columns.length

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Copo Loyalty'
  wb.created = generatedAt
  wb.title = `Clientes · ${program.programName}`

  const ws = wb.addWorksheet('Clientes', {
    properties: { tabColor: { argb: COLOR.primary }, defaultRowHeight: 20 },
    views: [{ state: 'frozen', xSplit: 1, ySplit: ROW.header, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: '&L&8Copo Loyalty&R&8Página &P de &N' },
  })
  ws.pageSetup.printTitlesRow = `${ROW.header}:${ROW.header}`

  addHeaderBlock(ws, wb, input, lastCol, generatedAt)

  // Encabezado de la tabla.
  const header = ws.getRow(ROW.header)
  header.height = 26
  columns.forEach((col, i) => {
    const cell = header.getCell(i + 1)
    cell.value = col.header
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.primary } }
    cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', indent: col.align === 'center' ? 0 : 1, wrapText: true }
    cell.border = { bottom: { style: 'medium', color: { argb: COLOR.primaryDark } } }
  })

  const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
  sorted.forEach((customer, index) => {
    const row = ws.getRow(ROW.header + 1 + index)
    row.height = 20
    columns.forEach((col, i) => {
      const cell = row.getCell(i + 1)
      // Siempre valores simples (texto/número/fecha), nunca fórmulas: lo que
      // escribe el cliente en el registro no puede ejecutarse al abrir el archivo.
      cell.value = col.get(customer)
      cell.font = { name: 'Calibri', size: 11, color: { argb: COLOR.text } }
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left', indent: col.align === 'center' ? 0 : 1 }
      if (col.numFmt) cell.numFmt = col.numFmt
      if (index % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } }
      cell.border = { bottom: { style: 'thin', color: { argb: COLOR.border } } }
      col.style?.(customer, cell)
    })
  })

  if (sorted.length === 0) {
    const row = ROW.header + 1
    ws.mergeCells(row, 1, row, lastCol)
    const cell = ws.getCell(row, 1)
    cell.value = 'Sin clientes todavía'
    cell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: COLOR.faint } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  } else {
    ws.autoFilter = { from: { row: ROW.header, column: 1 }, to: { row: ROW.header + sorted.length, column: lastCol } }
  }

  const footer = ws.getCell(ROW.header + Math.max(sorted.length, 1) + 2, 1)
  footer.value = 'Generado con Copo Loyalty'
  footer.font = { name: 'Calibri', size: 9, italic: true, color: { argb: COLOR.faint } }

  // Ancho de columnas según el contenido (acotado para que nada se desborde).
  // El encabezado lleva +5 porque la flecha del filtro tapa el final del texto.
  columns.forEach((col, i) => {
    const longestValue = Math.max(0, ...sorted.map(c => displayLength(col.get(c), col.numFmt)))
    ws.getColumn(i + 1).width = Math.min(42, Math.max(col.minWidth ?? 10, col.header.length + 5, longestValue + 3))
  })

  return wb
}

/** Trae todos los clientes del programa (el API devuelve máximo 100 por página). */
export async function fetchAllCustomers(programId: string): Promise<LoyaltyCustomer[]> {
  const pageSize = 100
  const all: LoyaltyCustomer[] = []
  for (let page = 1; page <= 500; page++) {
    const batch = await api.get<LoyaltyCustomer[]>(
      `/api/v1/loyalty/programs/${programId}/customers?limit=${pageSize}&page=${page}&sortBy=createdAt&sortDir=asc`,
    )
    all.push(...(batch ?? []))
    if (!batch || batch.length < pageSize) break
  }
  return all
}

/**
 * Carga el logo de Copo y recorta el espacio en blanco del PNG (viene en un
 * lienzo cuadrado con mucho margen). Si algo falla, se exporta sin logo.
 */
async function loadLogo(url: string): Promise<ExportLogo | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bitmap = await createImageBitmap(await res.blob())
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0)
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

    let minX = width, minY = height, maxX = -1, maxY = -1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = (y * width + x) * 4
        const visible = data[p + 3] > 16 && (data[p] < 240 || data[p + 1] < 240 || data[p + 2] < 240)
        if (visible) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX < 0) return null

    const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04)
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad)
    const sw = Math.min(width, maxX + pad + 1) - sx, sh = Math.min(height, maxY + pad + 1) - sy
    const out = document.createElement('canvas')
    out.width = sw
    out.height = sh
    out.getContext('2d')?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh)
    const blob = await new Promise<Blob | null>(resolve => out.toBlob(resolve, 'image/png'))
    return blob ? { buffer: await blob.arrayBuffer(), width: sw, height: sh } : null
  } catch {
    return null
  }
}

function slugify(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'programa'
}

/** Descarga el Excel con todos los clientes del programa. Devuelve cuántos se exportaron. */
export async function exportCustomersToExcel(programId: string, program: ExportProgram): Promise<number> {
  const [customers, logo] = await Promise.all([
    fetchAllCustomers(programId),
    loadLogo('/brand/copo-logo-horizontal.png'),
  ])
  const generatedAt = new Date()
  const wb = buildCustomersWorkbook({ program, customers, generatedAt, logo })
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `clientes-${slugify(program.programName)}-${generatedAt.toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revocar en el siguiente tick: algunos navegadores cancelan la descarga si se revoca de inmediato.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return customers.length
}
