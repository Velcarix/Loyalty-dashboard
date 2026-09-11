import { describe, expect, it } from 'vitest'
import { formatCoordinates, isShortMapsLink, parseCoordinates } from './maps'

describe('parseCoordinates', () => {
  it('reads plain "lat, lng"', () => {
    expect(parseCoordinates('19.4326, -99.1332')).toEqual({ latitude: 19.4326, longitude: -99.1332 })
  })

  it('prefers the place pin over the camera position in a Google Maps link', () => {
    const url = 'https://www.google.com/maps/place/Caf%C3%A9/@19.4200,-99.1600,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d19.4212!4d-99.1587'
    expect(parseCoordinates(url)).toEqual({ latitude: 19.4212, longitude: -99.1587 })
  })

  it('falls back to the @lat,lng camera position', () => {
    expect(parseCoordinates('https://www.google.com/maps/@25.6866,-100.3161,15z')).toEqual({ latitude: 25.6866, longitude: -100.3161 })
  })

  it('reads ?q=lat,lng links, encoded or not', () => {
    expect(parseCoordinates('https://maps.google.com/?q=20.6597,-103.3496')).toEqual({ latitude: 20.6597, longitude: -103.3496 })
    expect(parseCoordinates('https://www.google.com/maps/search/?api=1&query=20.6597%2C-103.3496')).toEqual({ latitude: 20.6597, longitude: -103.3496 })
  })

  it('rejects out-of-range or non-coordinate input', () => {
    expect(parseCoordinates('95, 20')).toBeNull()
    expect(parseCoordinates('Av. Reforma 222')).toBeNull()
    expect(parseCoordinates('')).toBeNull()
  })
})

describe('helpers', () => {
  it('detects short links and formats coordinates', () => {
    expect(isShortMapsLink('https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(isShortMapsLink('https://www.google.com/maps/@1,2,3z')).toBe(false)
    expect(formatCoordinates({ latitude: 19.4326077, longitude: -99.133208 })).toBe('19.43261, -99.13321')
  })
})
