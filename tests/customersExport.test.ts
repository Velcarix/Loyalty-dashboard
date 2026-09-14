import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildCustomersWorkbook, formatPhone, type ExportProgram } from '@/lib/customersExport'
import type { LoyaltyCustomer } from '@/types/loyalty'

const HEADER_ROW = 8

function customer(overrides: Partial<LoyaltyCustomer>): LoyaltyCustomer {
  return {
    id: 'c1', programId: 'p1', name: 'Cliente', phone: '0999000000', email: null,
    pointsBalance: 0, visitsCount: 0, totalEarnedPoints: 0,
    hasPendingReward: false, pendingRewardDescription: null,
    segment: 'active', createdAt: '2026-09-01T18:00:00.000Z', lastActivityAt: null,
    ...overrides,
  }
}

const program: ExportProgram = {
  programName: 'Titto Bros',
  askBirthday: true,
  askGender: true,
  customFields: [{ id: 'f1', label: 'Colonia', required: false }],
}

function headers(ws: ExcelJS.Worksheet): string[] {
  const values: string[] = []
  ws.getRow(HEADER_ROW).eachCell(cell => values.push(String(cell.value)))
  return values
}

describe('buildCustomersWorkbook', () => {
  const customers = [
    customer({
      id: 'b', name: 'Roberto Vargas', phone: '0992989799', email: 'r@hotmail.com', emailConsent: true,
      birthdayDate: '1993-02-02T00:00:00.000Z', gender: 'male', customFieldValues: { f1: 'Centro' },
      visitsCount: 4, hasPendingReward: true, pendingRewardDescription: 'Café gratis', segment: 'vip',
    }),
    customer({ id: 'a', name: 'Ana López', visitsCount: 2 }),
  ]

  it('incluye los datos que pide el programa como columnas', () => {
    const ws = buildCustomersWorkbook({ program, customers }).getWorksheet('Clientes')!
    expect(headers(ws)).toEqual([
      'Nombre', 'Teléfono', 'Correo', 'Acepta promociones', 'Visitas', 'Premio por canjear', 'Segmento',
      'Cumpleaños', 'Género', 'Colonia', 'Cliente desde', 'Última actividad',
    ])
  })

  it('agrupa teléfonos de 10 dígitos y con lada 52, y deja igual lo demás', () => {
    expect(formatPhone('9992989799')).toBe('999 298 9799')
    expect(formatPhone('+52 999-298-9799')).toBe('+52 999 298 9799')
    expect(formatPhone('12345')).toBe('12345')
  })

  it('ordena por nombre y respeta tipos: teléfono como texto, cumpleaños como fecha exacta', () => {
    const ws = buildCustomersWorkbook({ program, customers }).getWorksheet('Clientes')!
    expect(ws.getCell(HEADER_ROW + 1, 1).value).toBe('Ana López')
    const roberto = ws.getRow(HEADER_ROW + 2)
    expect(roberto.getCell(2).value).toBe('099 298 9799')
    const birthday = roberto.getCell(8).value as Date
    expect(birthday).toBeInstanceOf(Date)
    expect(birthday.toISOString().slice(0, 10)).toBe('1993-02-02')
    expect(roberto.getCell(6).value).toBe('Café gratis')
    expect(roberto.getCell(7).value).toBe('VIP')
    expect(roberto.getCell(9).value).toBe('Masculino')
    expect(roberto.getCell(10).value).toBe('Centro')
  })

  it('pone el resumen y el filtro sobre la tabla', () => {
    const ws = buildCustomersWorkbook({ program, customers }).getWorksheet('Clientes')!
    expect(ws.getCell(6, 1).value).toBe(2) // clientes
    expect(ws.getCell(6, 3).value).toBe(1) // aceptan promociones
    expect(ws.getCell(6, 5).value).toBe(1) // premios por canjear
    expect(ws.getCell(6, 7).value).toBe(6) // visitas
    expect(ws.autoFilter).toBeTruthy()
  })

  it('omite cumpleaños y género si el programa no los pide y nadie los tiene', () => {
    const ws = buildCustomersWorkbook({
      program: { ...program, askBirthday: false, askGender: false, customFields: null },
      customers: [customer({})],
    }).getWorksheet('Clientes')!
    expect(headers(ws)).not.toContain('Cumpleaños')
    expect(headers(ws)).not.toContain('Género')
  })

  it('genera un .xlsx válido y el texto del cliente nunca se vuelve fórmula', async () => {
    const wb = buildCustomersWorkbook({ program, customers: [customer({ name: '=HYPERLINK("http://x")' })] })
    const buffer = await wb.xlsx.writeBuffer()
    const reread = new ExcelJS.Workbook()
    await reread.xlsx.load(buffer as ArrayBuffer)
    const cell = reread.getWorksheet('Clientes')!.getCell(HEADER_ROW + 1, 1)
    expect(cell.type).toBe(ExcelJS.ValueType.String)
    expect(cell.value).toBe('=HYPERLINK("http://x")')
  })
})
