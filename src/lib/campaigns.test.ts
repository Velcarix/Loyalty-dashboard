import { describe, expect, it } from 'vitest'
import { campaignStatus, campaignTypeFor, describeDays, describeHours, localDateToIso, multiplierLabel } from './campaigns'

describe('campaignStatus', () => {
  const now = new Date('2026-09-11T12:00:00Z')
  it('knows paused, ended, scheduled and active', () => {
    expect(campaignStatus({ isActive: false, startsAt: null, endsAt: null }, now)).toBe('paused')
    expect(campaignStatus({ isActive: true, startsAt: null, endsAt: '2026-09-01T00:00:00Z' }, now)).toBe('ended')
    expect(campaignStatus({ isActive: true, startsAt: '2026-10-01T00:00:00Z', endsAt: null }, now)).toBe('scheduled')
    expect(campaignStatus({ isActive: true, startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-30T00:00:00Z' }, now)).toBe('active')
  })
})

describe('describe helpers', () => {
  it('lists days Monday-first and collapses the full week', () => {
    expect(describeDays([0, 5, 6])).toBe('Vie, Sáb, Dom')
    expect(describeDays([])).toBe('Todos los días')
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe('Todos los días')
  })

  it('describes the time window', () => {
    expect(describeHours('17:00', '19:00')).toBe('17:00 – 19:00')
    expect(describeHours(null, null)).toBe('todo el día')
    expect(describeHours('08:00', null)).toBe('desde 08:00')
  })

  it('labels the multiplier', () => {
    expect(multiplierLabel('2')).toBe('x2')
    expect(multiplierLabel(1.5)).toBe('x1.5')
  })
})

describe('campaignTypeFor', () => {
  it('derives the stored type from the form', () => {
    expect(campaignTypeFor({ hasTimeWindow: true, hasDates: true })).toBe('happy_hour')
    expect(campaignTypeFor({ hasTimeWindow: false, hasDates: true })).toBe('time_limited')
    expect(campaignTypeFor({ hasTimeWindow: false, hasDates: false })).toBe('double_points')
  })
})

describe('localDateToIso', () => {
  it('covers the whole local day', () => {
    const start = new Date(localDateToIso('2026-09-11', false))
    const end = new Date(localDateToIso('2026-09-11', true))
    expect(start.getHours()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
  })
})
