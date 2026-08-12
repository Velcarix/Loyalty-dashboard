import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('QR print security', () => {
  it('uses DOM text nodes instead of writing program data as HTML', async () => {
    const source = await readFile('src/components/RegistrationQrModal.tsx', 'utf8')
    expect(source).not.toMatch(/document\.write\s*\(/)
    expect(source).toMatch(/title\.textContent = program\.programName/)
    expect(source).toMatch(/body\.replaceChildren/)
  })
})
