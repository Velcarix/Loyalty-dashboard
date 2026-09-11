import { describe, expect, it } from 'vitest'
import { findExtremes, formatHourRange, joinNames, toCsv, WEEKDAY_DISPLAY_ORDER } from './metrics'

describe('findExtremes', () => {
  it('returns null when there were no scans', () => {
    expect(findExtremes([0, 0, 0, 0, 0, 0, 0])).toBeNull()
  })

  it('finds busiest and slowest days, keeping ties in display order', () => {
    // dom=4, lun=1, mar=9, mié=1, jue=2, vie=9, sáb=3
    const result = findExtremes([4, 1, 9, 1, 2, 9, 3], WEEKDAY_DISPLAY_ORDER)
    expect(result).toEqual({ maxValue: 9, minValue: 1, maxIndices: [2, 5], minIndices: [1, 3] })
  })
})

describe('joinNames', () => {
  it('joins names in Spanish', () => {
    expect(joinNames(['Lunes'])).toBe('Lunes')
    expect(joinNames(['Lunes', 'Martes'])).toBe('Lunes y Martes')
    expect(joinNames(['Lunes', 'Martes', 'Jueves'])).toBe('Lunes, Martes y Jueves')
    expect(joinNames(['Lun', 'Mar', 'Mié', 'Jue', 'Vie'])).toBe('Lun, Mar, Mié y 2 más')
  })
})

describe('formatHourRange', () => {
  it('wraps midnight', () => {
    expect(formatHourRange(13)).toBe('13:00 – 14:00')
    expect(formatHourRange(23)).toBe('23:00 – 00:00')
  })
})

describe('toCsv', () => {
  it('escapes quotes/commas and neutralizes spreadsheet formulas', () => {
    const csv = toCsv([['Nombre', 'Correo'], ['=HYPERLINK("x")', 'a,b@mail.com']])
    expect(csv).toBe('﻿Nombre,Correo\r\n"\'=HYPERLINK(""x"")","a,b@mail.com"')
  })
})
