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

describe('brand contrast', () => {
  it('isolates merchant logos from configurable card colors', async () => {
    const source = await readFile('src/components/WalletPassPreview.tsx', 'utf8')
    expect(source).toMatch(/bg-white/)
    expect(source).toMatch(/border-black\/10/)
  })

  it('uses Copo blue as the default program color', async () => {
    const source = await readFile('src/components/WalletPassPreview.tsx', 'utf8')
    expect(source).toContain("program.brandColor ?? '#2563EB'")
  })
})
