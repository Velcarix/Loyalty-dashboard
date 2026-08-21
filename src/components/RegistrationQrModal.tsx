import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { getTextColorForBg } from '@/lib/color'
import type { LoyaltyProgram } from '@/types/loyalty'

const FRONTEND_URL = (import.meta.env.VITE_PUBLIC_FRONTEND_URL as string | undefined) ?? 'https://joinloyalty.copopos.com'

interface Props {
  program: LoyaltyProgram
  onClose: () => void
}

export function RegistrationQrModal({ program, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [copied, setCopied] = useState(false)
  const registerUrl = `${FRONTEND_URL}/loyalty-join.html?cardId=${program.id}`
  const textColor = getTextColorForBg(program.brandColor)

  useEffect(() => {
    if (!canvasRef.current) return
    void QRCode.toCanvas(canvasRef.current, registerUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#111111', light: '#FFFFFF' },
    })
  }, [registerUrl])

  async function handleCopy() {
    await navigator.clipboard.writeText(registerUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-registro-${program.programName.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handlePrint() {
    const canvas = canvasRef.current
    if (!canvas) return
    const win = window.open('', '_blank')
    if (!win) return
    const { document: printDocument } = win
    printDocument.title = `QR — ${program.programName}`
    printDocument.body.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;'
    const title = printDocument.createElement('h2')
    title.textContent = program.programName
    const image = printDocument.createElement('img')
    image.src = canvas.toDataURL('image/png')
    image.width = 300
    image.height = 300
    image.alt = `QR de registro de ${program.programName}`
    const instruction = printDocument.createElement('p')
    instruction.textContent = 'Escanea para unirte'
    printDocument.body.replaceChildren(title, image, instruction)
    win.focus()
    win.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">QR de registro</h3>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400">×</button>
        </div>

        <div
          style={{ backgroundColor: program.brandColor, color: textColor }}
          className="mb-4 flex flex-col items-center rounded-2xl p-6"
        >
          <p className="mb-1 text-base font-bold">{program.programName}</p>
          <p className="mb-4 text-xs opacity-80">{program.description}</p>
          <div className="rounded-xl bg-white p-3">
            <canvas ref={canvasRef} />
          </div>
          <p className="mt-4 text-xs font-bold">Escanea para unirte</p>
        </div>

        <div className="mb-4 rounded-xl bg-blue-50 p-3">
          <p className="mb-1 text-xs text-gray-500">Link de registro</p>
          <p className="break-all font-mono text-xs text-blue-700">{registerUrl}</p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleCopy} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700">
            {copied ? 'Copiado ✓' : 'Copiar link'}
          </button>
          <button onClick={handleDownload} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700">
            Descargar
          </button>
          <button onClick={handlePrint} className="flex-1 rounded-lg bg-primary py-2 text-sm font-bold text-white">
            Imprimir
          </button>
        </div>
      </div>
    </div>
  )
}
