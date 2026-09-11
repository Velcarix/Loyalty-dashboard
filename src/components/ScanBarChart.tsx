interface Bar {
  key: number
  label: string
  /** Etiqueta completa para tooltip y lector de pantalla (ej. "Sábado", "13:00 – 14:00"). */
  fullLabel: string
  value: number
}

interface ScanBarChartProps {
  bars: Bar[]
  /** Barras resaltadas (máximo) — el resto va en tono atenuado del mismo color. */
  highlight: number[]
  caption: string
  /** Mostrar etiqueta del eje X solo cada N barras (útil para 24 horas). */
  labelEvery?: number
}

// Serie única: un solo tono (primary), la barra pico al 100 % y el resto atenuado.
// Sin leyenda — el título del panel nombra la serie.
export function ScanBarChart({ bars, highlight, caption, labelEvery = 1 }: ScanBarChartProps) {
  const max = Math.max(1, ...bars.map(b => b.value))
  const unit = (n: number) => `${n} ${n === 1 ? 'escaneo' : 'escaneos'}`

  return (
    <figure>
      <div className="flex h-40 items-end gap-0.5 border-b border-slate-200" aria-hidden="true">
        {bars.map(bar => {
          const isPeak = highlight.includes(bar.key)
          const height = bar.value === 0 ? 0 : Math.max(3, (bar.value / max) * 100)
          return (
            <div key={bar.key} className="group relative flex h-full flex-1 items-end justify-center">
              <div
                className={`w-full max-w-10 rounded-t transition-colors ${isPeak ? 'bg-primary' : 'bg-primary/25 group-hover:bg-primary/45'}`}
                style={{ height: `${height}%` }}
              />
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white shadow group-hover:block">
                {bar.fullLabel} · {unit(bar.value)}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-0.5" aria-hidden="true">
        {bars.map((bar, i) => (
          <span key={bar.key} className={`flex-1 text-center text-[11px] ${highlight.includes(bar.key) ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
            {i % labelEvery === 0 ? bar.label : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <tbody>
          {bars.map(bar => (
            <tr key={bar.key}><th scope="row">{bar.fullLabel}</th><td>{unit(bar.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
