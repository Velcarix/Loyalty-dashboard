import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Icon } from '@/components/Icon'
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

  // Cartel tamaño carta listo para imprimir o "Guardar como PDF" desde el
  // diálogo de impresión — sin generar PDF en el servidor. Todo el texto va
  // por textContent; los colores son hex ya validados por el backend.
  function handlePrint() {
    const canvas = canvasRef.current
    if (!canvas) return
    const win = window.open('', '_blank')
    if (!win) return
    const doc = win.document
    doc.title = `Cartel QR — ${program.programName}`
    // El color entra al CSS del cartel: solo si es un hex válido.
    const brand = /^#[0-9a-fA-F]{6}$/.test(program.brandColor) ? program.brandColor : '#2563EB'
    const ink = /^#[0-9a-fA-F]{3,8}$/.test(textColor) ? textColor : '#FFFFFF'

    const style = doc.createElement('style')
    style.textContent = `
      @page { size: letter; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;
             -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .poster { min-height: calc(100vh - 2px); display: flex; flex-direction: column; align-items: center; text-align: center;
                border: 1px solid #e2e8f0; border-radius: 28px; overflow: hidden; }
      .top { width: 100%; padding: 44px 32px 36px; background: ${brand}; color: ${ink}; }
      .top img { max-height: 72px; max-width: 220px; object-fit: contain; margin-bottom: 18px; }
      .top h1 { margin: 0; font-size: 42px; letter-spacing: -0.02em; line-height: 1.05; }
      .top p { margin: 10px auto 0; max-width: 34ch; font-size: 18px; opacity: .85; }
      .middle { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
      .cta { margin: 0 0 18px; font-size: 30px; font-weight: 800; letter-spacing: -0.01em; }
      .qr { width: 300px; height: 300px; padding: 14px; border-radius: 22px; border: 3px solid ${brand}; background: #fff; }
      ol { list-style: none; padding: 0; margin: 30px 0 0; display: grid; gap: 12px; text-align: left; font-size: 18px; }
      li { display: flex; align-items: center; gap: 12px; }
      li span { flex: none; width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center;
                background: ${brand}; color: ${ink}; font-weight: 800; font-size: 16px; }
      .foot { padding: 0 24px 26px; font-size: 12px; color: #64748b; word-break: break-all; }
    `

    const poster = doc.createElement('div')
    poster.className = 'poster'

    const top = doc.createElement('div')
    top.className = 'top'
    if (program.logoUrl) {
      const logo = doc.createElement('img')
      logo.src = program.logoUrl
      logo.alt = ''
      top.appendChild(logo)
    }
    const title = doc.createElement('h1')
    title.textContent = program.programName
    top.appendChild(title)
    if (program.description) {
      const description = doc.createElement('p')
      description.textContent = program.description
      top.appendChild(description)
    }

    const middle = doc.createElement('div')
    middle.className = 'middle'
    const cta = doc.createElement('p')
    cta.className = 'cta'
    cta.textContent = 'Únete gratis a nuestra tarjeta'
    const qr = doc.createElement('img')
    qr.className = 'qr'
    qr.src = canvas.toDataURL('image/png')
    qr.alt = `QR de registro de ${program.programName}`
    const steps = doc.createElement('ol')
    ;['Escanea este código con la cámara', 'Regístrate con tu teléfono', 'Guarda tu tarjeta en Apple Wallet o Google Wallet'].forEach((text, index) => {
      const item = doc.createElement('li')
      const number = doc.createElement('span')
      number.textContent = String(index + 1)
      item.append(number, doc.createTextNode(text))
      steps.appendChild(item)
    })
    middle.append(cta, qr, steps)

    const foot = doc.createElement('p')
    foot.className = 'foot'
    foot.textContent = registerUrl

    poster.append(top, middle, foot)
    doc.head.appendChild(style)
    doc.body.replaceChildren(poster)

    // Esperar a que carguen logo y QR: si no, el diálogo de impresión sale sin ellos.
    const images = Array.from(doc.images)
    void Promise.all(images.map(img => img.decode().catch(() => undefined))).then(() => {
      win.focus()
      win.print()
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">QR de registro</h3>
          <button onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Cerrar">
            <Icon name="x" size={20} />
          </button>
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
            {copied ? <span className="inline-flex items-center gap-1"><Icon name="check" size={16} />Copiado</span> : 'Copiar link'}
          </button>
          <button onClick={handleDownload} className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700">
            Descargar
          </button>
          <button onClick={handlePrint} title="Imprime el cartel o guárdalo como PDF" className="flex-1 rounded-lg bg-primary py-2 text-sm font-bold text-white">
            Cartel / PDF
          </button>
        </div>
      </div>
    </div>
  )
}
